import { dsls } from '@jb6/core'
import '@jb6/llm-guide'

const { 
  doclet: { 
    specification, useCase, endUser, admin, motivation, goal, backgroundKnowledge, inventedUserStory
  } 
} = dsls

specification('whatsappToKnowledge', {
  introduction: 'Inside WhatsApp groups there is a lot of knowledge to be extracted. We would like to build a system that can automatically identify, extract, categorize, and make searchable the valuable information shared in group conversations.',

  useCases: [
    useCase({
      goal: 'Extract and categorize valuable information from WhatsApp group conversations',
      importance: 'critical',
      relevantActors: [
        endUser({
          description: 'Group members who share and consume knowledge within WhatsApp groups',
          features: [
            motivation('Want to easily find information previously shared in the group'),
            goal('Access structured knowledge without scrolling through hundreds of messages'),
            backgroundKnowledge('Familiar with WhatsApp but may not be tech-savvy')
          ]
        })
      ],
      flow: 'System monitors WhatsApp conversations, extracts knowledge, categorizes it, makes it searchable',
      exampleScenarios: [
        inventedUserStory({
          context: 'Software development team WhatsApp group',
          actors: 'Sarah (Team Lead), Mike (Senior Developer)',
          motivation: 'Team shares technical solutions but struggles to find them later',
          interactionDescription: 'Mike shares database solution, system extracts and categorizes it for future search'
        })
      ]
    })
  ]
})
