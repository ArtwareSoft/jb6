import { coreUtils, jb, dsls } from '@jb6/core'
import '@jb6/react/mjpeg-utils.js'
import { spawn } from 'child_process'

const {
  rx: { ReactiveSource }
} = dsls

jb.serverUtils = jb.serverUtils || {}
Object.assign(jb.serverUtils, {serveMjpeg})

const MJPEG_BOUNDARY = 'frame'
const MP4_DURATION = 10 // seconds
const MP4_FPS = 25

function formatMjpegFrame(jpegBuffer) {
  const frameHeader = Buffer.from(
    `--${MJPEG_BOUNDARY}\r\n` +
    `Content-Type: image/jpeg\r\n` +
    `Content-Length: ${jpegBuffer.length}\r\n\r\n`
  )
  return Buffer.concat([frameHeader, jpegBuffer, Buffer.from('\r\n')])
}

function formatMjpegEnd() {
  return Buffer.from(`--${MJPEG_BOUNDARY}--\r\n`)
}

async function serveMjpeg(app) {
    coreUtils.globalsOfTypeIds(ReactiveSource).filter(id=>id.indexOf('mjpeg') == 0).forEach(mjpegSrcId => {
        app.get(`/${mjpegSrcId}`, async (req, res) => {
            try {
                console.log(`Starting MJPEG stream: ${mjpegSrcId}`)
                
                dsls.rx['reactive-source'][mjpegSrcId].$run()(0, (t, data) => {
                    if (req.destroyed) return // Client already disconnected
                    
                    try {
                        if (t === 1) {
                            // Data received
                            if (data.type === 'mjpeg_headers') {
                                console.log(`Sending headers for: ${mjpegSrcId}`)
                                res.writeHead(200, {
                                    'Content-Type': `multipart/x-mixed-replace; boundary=${MJPEG_BOUNDARY}`,
                                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                                    'Pragma': 'no-cache',
                                    'Expires': '0'
                                })
                            } else if (data.type === 'mjpeg_frame') {
                                res.write(formatMjpegFrame(data.jpegBuffer))
                            } else if (data.type === 'mjpeg_end') {
                                console.log(`Ending stream: ${mjpegSrcId}`)
                                res.write(formatMjpegEnd())
                                res.end()
                            }
                        } else if (t === 2) {
                            // Source ended
                            console.log(`Source ended: ${mjpegSrcId}`)
                            if (!res.headersSent) {
                                res.status(500).send('Stream ended unexpectedly')
                            } else {
                                res.end()
                            }
                        }
                    } catch (writeError) {
                        console.error('Error writing to response:', writeError)
                        handleDisconnect()
                    }
                })
            } catch (err) {
                console.error('MJPEG serve error:', err)
                res.status(500).send('Internal server error')
            }
        })
        
        console.log(`MJPEG endpoint registered: /${mjpegSrcId}`)
        
        // MP4 download endpoint - captures 10 seconds and converts to MP4
        const mp4Endpoint = mjpegSrcId.replace('mjpeg.', 'mp4.')
        app.get(`/${mp4Endpoint}`, async (req, res) => {
            try {
                console.log(`Starting MP4 generation: ${mp4Endpoint}`)
                
                const totalFrames = MP4_DURATION * MP4_FPS
                let frameCount = 0
                let ffmpegClosed = false
                const startTime = performance.now()
                
                // Create temp file for proper MP4 structure
                const os = await import('os')
                const path = await import('path')
                const fs = await import('fs')
                const tempFile = path.join(os.tmpdir(), `${mp4Endpoint.replace(/mp4\./,'')}-${Date.now()}.mp4`)
                console.log(`MP4 temp file: ${tempFile}`)
                
                // Spawn FFmpeg to convert JPEG frames to MP4 file
                const ffmpeg = spawn('ffmpeg', [
                    '-y',
                    '-f', 'image2pipe',
                    '-c:v', 'mjpeg',
                    '-framerate', String(MP4_FPS),
                    '-i', '-',
                    '-c:v', 'libx264',
                    '-profile:v', 'baseline',    // Better compatibility
                    '-level', '3.0',
                    '-pix_fmt', 'yuv420p',
                    '-preset', 'fast',
                    '-movflags', '+faststart',   // Move moov atom to start for streaming
                    tempFile
                ])
                
                let ffmpegError = ''
                ffmpeg.stderr.on('data', (data) => {
                    ffmpegError += data.toString()
                })
                
                ffmpeg.on('close', (code) => {
                    ffmpegClosed = true
                    if (code !== 0) {
                        console.error(`FFmpeg closed with code ${code}:`, ffmpegError.slice(-500))
                        if (!res.headersSent) {
                            res.status(500).send('FFmpeg error')
                        }
                    } else {
                        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
                        console.log(`mp4 completed in ${elapsed}s: ${tempFile}`)
                        // Send the file
                        res.setHeader('Content-Type', 'video/mp4')
                        res.setHeader('Content-Disposition', `attachment; filename="${mp4Endpoint}.mp4"`)
                        const fileStream = fs.createReadStream(tempFile)
                        fileStream.pipe(res)
                    }
                })
                
                ffmpeg.on('error', (err) => {
                    ffmpegClosed = true
                    console.error('FFmpeg spawn error:', err)
                    if (!res.headersSent) {
                        res.status(500).send('FFmpeg error')
                    }
                })
                
                // Handle stdin errors
                ffmpeg.stdin.on('error', (err) => {
                    if (err.code !== 'EPIPE') {
                        console.error('FFmpeg stdin error:', err)
                    }
                })
                
                // Capture frames from the stream
                let stopSource = null
                let sourceStopped = false
                dsls.rx['reactive-source'][mjpegSrcId].$run()(0, (t, data) => {
                    if (ffmpegClosed || frameCount >= totalFrames || sourceStopped) {
                        if (stopSource && !sourceStopped) {
                            sourceStopped = true
                            try { stopSource() } catch {}
                        }
                        return
                    }
                    
                    if (t === 0) {
                        // Save the talkback to stop the source
                        stopSource = () => data(2)
                    } else if (t === 1) {
                        if (data.type === 'mjpeg_frame') {
                            frameCount++
                            try {
                                ffmpeg.stdin.write(data.jpegBuffer)
                            } catch (e) {
                                // Ignore write errors if FFmpeg closed
                            }
                            
                            if (frameCount >= totalFrames) {
                                console.log(`MP4 complete: ${frameCount} frames`)
                                sourceStopped = true
                                try { ffmpeg.stdin.end() } catch {}
                                try { if (stopSource) stopSource() } catch {}
                            }
                        }
                    }
                })
                
            } catch (err) {
                console.error('MP4 generation error:', err)
                res.status(500).send('Internal server error')
            }
        })
        
        console.log(`MP4 endpoint registered: /${mp4Endpoint}`)
    })
}