export const assistantPanelEn = {
  newConversation: 'New conversation',
  back: 'Back',
  close: 'Close',
  articleToGalgame: 'Article to Galgame',
  uploadArticle: 'Upload article documents',
  showAnalysis: 'Show AI analysis process',
  generateChapterRegions: 'Generate chapter regions',
  generateCharacters: 'Generate character card candidates',
  storyPartner: 'Your AI story partner',
  tryAsking: 'Try asking me:',
  position: 'Position',
  documents: 'Reference documents',
  suggestions: 'Suggestions',
  send: 'Send',
  heroTitle: 'Ready to turn ideas into finished work',
  shortDrama: 'Quick short drama',
  generateCards: 'Generate cards',
  inputPlaceholder:
    'Discuss the story with AI, or ask it to generate or revise characters, scenes, and story cards…',
  futureWriting: 'Future writing plan',
  cardReview: {
    taskTitlePrefix: 'Review',
    requestText:
      'Review this card with its adjacent story context and suggest concrete improvements.',
    selectedCard: 'Selected card',
    adjacentContext: 'Card to edit and adjacent story context',
    contextBadge: 'Card context',
    removeAttachment: 'Remove attachment',
    analyzing: 'Analyzing card',
    complete: 'Card suggestions are ready',
    exactlyThreeError: 'AI did not return three complete suggestions',
    fallbackDiagnosis: 'I found three concrete improvements for this card and its adjacent story.',
    failure: 'Card review failed: {reason}',
    retry: 'Please try again later',
    prompt: `You are a Galgame script editor. Analyze only the target card and its adjacent story below. Do not generate images or directly modify the canvas.

{context}

Identify the most important issue in this card and provide exactly three actionable suggestions tied directly to its actual content. Avoid generic ideas such as “optimize it,” “continue writing,” or “try another idea.” Each suggestion must target specific information in the card and explain the expected effect.

Return JSON only:
{"diagnosis":"one specific diagnostic sentence","options":[{"label":"short action title","description":"what to change and why"}]}`,
  },
  welcomePrompts: {
    idea: {
      title: 'I have a new idea',
      description: 'Turn one spark into a story premise, cast, and conflict.',
      prompt: 'I have a new idea. Help me expand it into a complete story.',
    },
    continue: {
      title: 'I want to keep writing',
      description: 'Continue the current plot with the next scene, dialogue, or storyboard.',
      prompt: 'I want to continue writing. Help me move the current story forward.',
    },
    article: {
      title: 'I want to turn an article into a Galgame',
      description: 'Upload a PDF or Word document to turn it into an editable galgame.',
      prompt:
        'I want to turn an article into a galgame. I will upload a PDF or Word document; please extract its content into editable visual-novel cards.',
    },
  },
  articleFlow: {
    uploadTitle: 'Upload an article and turn it into teachable chapters',
    uploadDescription:
      'I will analyze the article, ask how it should be taught, then generate chapter regions and story cards on the canvas.',
    analyzingTitle: 'AI is analyzing the article…',
    errorTitle: 'There was a problem analyzing the article',
    readyTitle: 'Article structure is ready',
    dropTitle: 'Drop PDF or Word documents here',
    dropDescription:
      'You can also click to choose files. PDF, Word, Excel, PPT, and common text files are supported.',
    learningPrompt: 'Choose how readers should learn this article:',
    characterDescription:
      'The assistant will place three role templates and one blank fill-in card.',
    analysisRunning: 'AI article analysis in progress...',
    analysisFailed: 'AI article analysis failed',
    analysisComplete: 'AI article analysis complete',
    documentSummary: 'Read {count} document(s), about {characters} characters.',
    documentSummaryEmpty: 'Document analysis results will appear here after upload.',
    documentReading: 'Reading uploaded document...',
    documentExtracting: 'Extracting readable text, headings, and paragraphs.',
    documentExtracted:
      'Extracted readable text from {count} document(s), about {characters} characters.',
    textApiMissing: 'Unable to run real AI reading: no text AI API is configured.',
    steps: {
      reading: {
        title: 'Reading Article',
        pending: 'Waiting to extract text, headings, and paragraphs.',
      },
      ideas: {
        title: 'Finding Core Ideas',
        pending: 'Waiting for AI to identify topic, claims, and key concepts.',
        active: 'AI is reading the full text to identify topic, claims, and key concepts.',
        fallback: 'The article topic and core ideas have been identified.',
      },
      chapters: {
        title: 'Structuring Chapters',
        pending: 'Waiting for AI to split chapters and knowledge order.',
        active: 'AI is splitting the article into chapters and knowledge order.',
        fallback: 'Chapters have been structured from the article logic.',
      },
      teaching: {
        title: 'Planning Teaching Path',
        pending: 'Waiting for AI to plan questions, explanations, and feedback flow.',
        active: 'AI is turning knowledge points into questions, explanations, and feedback.',
        fallback: 'The teaching path has been planned.',
      },
      galgame: {
        title: 'Converting to Galgame',
        pending: 'Waiting for AI to plan roles, scenes, dialogue rhythm, and chapter regions.',
        active: 'AI is planning roles, scenes, dialogue rhythm, and chapter regions.',
        fallback: 'Roles, scenes, and chapter regions have been planned for the Galgame.',
      },
      teachingStyle: {
        title: 'Choose Teaching Style',
        pending: 'After real analysis completes, choose how to turn it into a Galgame.',
        complete:
          'Real analysis is complete. Choose interactive or lecture teaching to generate chapter regions and story cards.',
        evidence:
          'Generation will reuse the topic, chapter, teaching path, and Galgame conversion analysis above.',
      },
    },
  },
} as const;
