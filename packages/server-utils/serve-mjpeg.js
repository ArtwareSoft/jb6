import { coreUtils, jb, dsls, ns } from '@jb6/core'
import '@jb6/react/mjpeg-utils.js'
import { spawn } from 'child_process'
import '@jb6/common'
import '@jb6/rx'
import '@jb6/rx/rx-common.js'

const {
  common: { data : { pipe }},
  rx: { ReactiveSource },
} = dsls
const { rx } = ns

jb.serverUtils = jb.serverUtils || {}
Object.assign(jb.serverUtils, {serveMjpeg})

const MJPEG_BOUNDARY = 'frame'

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

const mjpegThrottle = ReactiveSource('mjpegThrottle', {
    impl: (ctx) => source => (start, sink) => {
        if (start !== 0) return
        let fps = 0
        let lastFrameTime = 0
        let timerId = null
        const queue = []

        const deliver = () => {
            timerId = null
            if (queue.length === 0) return

            const { t, d } = queue[0]
            const message = d && d.data

            if (t === 1 && message?.type === 'mjpeg_frame' && fps) {
                const now = performance.now()
                const wait = Math.max(0, lastFrameTime + (1000 / fps) - now)
                if (wait > 1) {
                    timerId = setTimeout(deliver, wait)
                    return
                }
                lastFrameTime = performance.now()
            }

            queue.shift()
            if (t === 1 && message?.type === 'mjpeg_headers' && message.fps) fps = message.fps
            sink(t, d)
            
            if (t !== 2 && queue.length > 0) {
                timerId = setTimeout(deliver, 0)
            }
        }

        source(0, (t, d) => {
            if (t === 0) {
                sink(0, t2 => d(t2))
            } else {
                queue.push({ t, d })
                if (!timerId) timerId = setTimeout(deliver, 0)
            }
        })
    }
})

async function serveMjpeg(app) {
    coreUtils.globalsOfTypeIds(ReactiveSource).filter(id=>id.indexOf('mjpeg') == 0).forEach(mjpegSrcId => {
        app.get(`/${mjpegSrcId}`, async (req, res) => {
            try {
                console.log(`Starting MJPEG stream: ${mjpegSrcId}`)
                const source = rx.pipe.$run(dsls.rx['reactive-source'][mjpegSrcId](), mjpegThrottle())
                source(0, async (t, _ctx) => {
                    if (req.destroyed) return // Client already disconnected
                    try {
                        if (t === 1) {
                            const { data }  = _ctx
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
                    }
                })
            } catch (err) {
                console.error('MJPEG serve error:', err)
                res.status(500).send('Internal server error')
            }
        })
        
        console.log(`MJPEG endpoint registered: /${mjpegSrcId}`)
        
        // MP4 download endpoint - captures frames and then converts to MP4
        const mp4Endpoint = mjpegSrcId.replace('mjpeg.', 'mp4.')
        app.get(`/${mp4Endpoint}`, async (req, res) => {
            try {
                console.log(`Starting MP4 generation: ${mp4Endpoint}`)
                const startTime = performance.now()
                const rxPipe = rx.pipe(dsls.rx['reactive-source'][mjpegSrcId](), rx.toArray())
                const collectedMessages = (await pipe.$run(rxPipe))[0]

                console.log(`Collected ${collectedMessages.length} messages, starting FFmpeg`)
                const headers = collectedMessages.find(m => m.type === 'mjpeg_headers')
                const frames = collectedMessages.filter(m => m.type === 'mjpeg_frame').map(m => m.jpegBuffer)

                if (frames.length === 0) {
                    return res.status(500).send('No frames collected')
                }

                const outFps = headers.fps
                console.log(`Using FPS: ${outFps}`)

                // 2. Process with FFmpeg
                const os = await import('os')
                const path = await import('path')
                const fs = await import('fs')
                const tempFile = path.join(os.tmpdir(), `${mp4Endpoint.replace(/mp4\./,'')}-${Date.now()}.mp4`)
                
                const ffmpeg = spawn('ffmpeg', [
                    '-y',
                    '-f', 'image2pipe',
                    '-c:v', 'mjpeg',
                    '-framerate', String(outFps),
                    '-i', '-',
                    '-c:v', 'libx264',
                    '-profile:v', 'baseline',
                    '-level', '3.0',
                    '-pix_fmt', 'yuv420p',
                    '-preset', 'fast',
                    '-movflags', '+faststart',
                    tempFile
                ])

                let ffmpegError = ''
                ffmpeg.stderr.on('data', (data) => ffmpegError += data.toString())
                
                ffmpeg.on('close', (code) => {
                    if (code !== 0) {
                        console.error(`FFmpeg closed with code ${code}:`, ffmpegError.slice(-500))
                        if (!res.headersSent) res.status(500).send('FFmpeg error')
                    } else {
                        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1)
                        console.log(`mp4 completed in ${elapsed}s: ${tempFile}`)
                        res.setHeader('Content-Type', 'video/mp4')
                        res.setHeader('Content-Disposition', `attachment; filename="${mp4Endpoint}.mp4"`)
                        fs.createReadStream(tempFile).pipe(res)
                    }
                })

                // Pipe all collected frames to ffmpeg
                frames.forEach(frame => ffmpeg.stdin.write(frame))
                ffmpeg.stdin.end()
                
            } catch (err) {
                console.error('MP4 generation error:', err)
                if (!res.headersSent) res.status(500).send('Internal server error')
            }
        })
        
        console.log(`MP4 endpoint registered: /${mp4Endpoint}`)
    })
}