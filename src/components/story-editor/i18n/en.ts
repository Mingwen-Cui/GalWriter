export const storyEditorEn = {
  copySuccess: 'Copied to clipboard!',
  assistantMemoryDownloaded: 'Assistant memory downloaded',
  textCopied: 'Text copied',
  voiceApiRequired: 'Connect a Voice AI API in Settings > AI Settings > Voice AI first',
  imageApiRequired: 'Connect an Image AI API in Settings > AI Settings > Image AI first',
  generatingAudio: 'Generating audio',
  existingAudio: 'Existing audio',
  textAudioName: 'Text audio {number}',
  audioGenerated: 'Audio generated',
  audioGenerationFailed: 'Audio generation failed',
  branchTitle: 'Branch',
  storylineTraced: 'Storyline traced',
  aiGenerationFailed: 'AI generation failed',
  checkApiNetwork: 'Check your API key and network connection.',
  regionEmpty: 'There are no cards in this area to send to AI.',
  regionContext:
    'Read and use the cards in the "{regionTitle}" area as the current writing context.\n\n{content}',
  regionLimit: 'You can attach up to 10 area groups to the AI assistant.',
  plotUnable: 'Unable to generate',
  plotNoCards: 'No story cards were found in this area to continue from.',
  plotBriefDetail: 'Use 1-3 sentences per card and move the plot forward concisely.',
  plotDetailedDetail:
    'Develop each card in detail, including scene description, action, and character dialogue.',
  plotStandardDetail: 'Use 2-3 sentences per card.',
  plotDirectionRight: 'right',
  plotDirectionLeft: 'left',
  plotDirectionDown: 'down',
  plotDirectionUp: 'up',
  plotPrompt: `You are a professional interactive-script and visual-novel writer.

Existing story in this area, in order:
{existingContent}

The user's desired direction:
{direction}

Card layout direction:
{layoutDirection}

Generate {cardCount} continuation cards from the content and direction above.
Detail requirement: {detailText}

Return exactly this format. Start each card with a ### heading, put its body on following lines, and include no other explanation:
### Card title
Body text

### Card title
Body text`,
  parsingFailed: 'Parsing failed',
  parseResponseFailed: 'The AI response could not be parsed. Please try again.',
  plotGenerationFailed: 'Plot generation failed',
  aiAnalysisFailed: 'AI analysis failed',
  checkNetworkApi: 'Check your network and API configuration.',
  quitTitle: 'Quit app?',
  quitDescription: 'Are you sure you want to quit GalWriter?',
  quitConfirm: 'Quit',
  cancel: 'Cancel',
  deleteProjectTitle: 'Delete project?',
  deleteProjectsDescription: 'Delete these {count} projects? This cannot be undone.',
  deleteProjectDescription: 'Delete "{name}"? This cannot be undone.',
  untitledProject: 'Untitled project',
  deleteProjectConfirm: 'Delete project',
  closeConversationTitle: 'Close conversation?',
  closeConversationDescription: 'Close "{name}"?',
  unnamedConversation: 'this conversation',
  closeConversationConfirm: 'Close conversation',
};
