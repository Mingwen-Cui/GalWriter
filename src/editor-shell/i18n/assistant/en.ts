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
    showSelectedCards: 'Show selected cards',
    analyzing: 'Analyzing card',
    complete: 'Card suggestions are ready',
    exactlyThreeError: 'AI did not return three complete suggestions',
    fallbackDiagnosis: 'I found three concrete improvements for this card and its adjacent story.',
    failure: 'Card review failed: {reason}',
    retry: 'Please try again later',
    useSuggestion: 'Continue editing',
    compactInstruction:
      'Output limits: diagnosis must be at most 24 words. Each label must be at most 8 words, and each description must be one concrete edit sentence of at most 40 words. Do not explain reasoning, repeat the card, or use Markdown.',
    prompt: `You are a Galgame script editor. Analyze only the target card and its adjacent story below. Do not generate images or directly modify the canvas.

{context}

Identify the most important issue in this card and provide exactly three actionable suggestions tied directly to its actual content. Avoid generic ideas such as “optimize it,” “continue writing,” or “try another idea.” Each suggestion must target specific information in the card and explain the expected effect.

Return JSON only:
{"diagnosis":"one specific diagnostic sentence","options":[{"label":"short action title","description":"what to change and why"}]}`,
  },
  profileFlow: {
    welcome: {
      title: 'Get to know me',
      description: 'A few quick choices help me find story openings that feel more like you.',
    },
    intro:
      'I will ask five quick questions about your story taste. Skip anything you do not want to answer.',
    savedIntro:
      'I still remember your saved story taste. You can refresh it, or use it to create fresh openings.',
    progress: 'Question {current}/5',
    chooseOne: 'Choose the closest answer, or write your own.',
    chooseUpToThree: 'Pick up to 3, then tap Done. You can also write your own.',
    skip: 'Skip this',
    custom: 'Write my own',
    customHint: 'Tell me in your own words. I will use it only as a story preference.',
    done: 'Done',
    useSaved: 'Use my saved taste',
    refresh: 'Update my taste',
    generating: 'I am shaping three different openings for you…',
    resultIntro:
      'Here are three openings based on what you chose. Pick one to develop, or generate another set.',
    regenerate: 'Give me three more',
    save: 'Remember these preferences on this device',
    saved: 'Saved as your local story taste. You can update it later.',
    saveFailed: 'I could not save those preferences on this device.',
    chooseOpening: 'Use this opening',
    generateCards: 'Build this into story cards',
    discuss: 'Let’s refine this opening first',
    openingSelected: '“{title}” is selected. What would you like to do next?',
    discussHint: 'Tell me what you would like to adjust about this opening.',
    failure: 'I could not create three complete openings. Please try again.',
    profileSummary:
      'persona: {persona}\ngenres: {genres}\nrelationship and tension: {dynamics}\nworldbuilding: {worlds}\nplot direction: {plots}\nnotes: {notes}',
    batchBackgrounds: {
      character: 'Characters',
      scene: 'World & Scenes',
      logic: 'Branches & Conditions',
      story: 'Story Progression',
    },
    questions: {
      persona: {
        title: 'When you enter a story, who do you feel most like?',
        action: 'The person who acts first',
        observer: 'The quiet observer with a secret',
        tender: 'The soft-hearted person who hides it',
        unpredictable: 'The wildcard who changes the room',
      },
      genre: {
        title: 'Which genres pull you in?',
        mystery: 'Mystery and secrets',
        romance: 'Romance and longing',
        healing: 'Healing daily life',
        fantasy: 'Fantasy adventure',
        scifi: 'Near-future sci-fi',
        youth: 'Youth and campus stories',
      },
      dynamics: {
        title: 'Which relationship or story tension do you want to feel?',
        slowburn: 'Slow-burn closeness',
        rivals: 'Rivals drawn together',
        reunion: 'A fated reunion',
        power: 'A dangerous power game',
        contrast: 'A striking contrast in personalities',
        trust: 'Trust built after betrayal',
      },
      world: {
        title: 'What kind of world do you want to step into?',
        city: 'A real modern city with one hidden crack',
        campus: 'A school where something is off',
        fantasy: 'A fully imagined fantasy world',
        future: 'A near-future world changed by technology',
        closed: 'A closed place with a mystery',
        ordinary: 'An ordinary life that slowly becomes strange',
      },
      plot: {
        title: 'How should this story begin to move?',
        mission: 'A high-pressure mission',
        mystery: 'A clue that must be chased',
        encounter: 'An unexpected encounter',
        return: 'Someone or something returns',
        choice: 'A choice that changes everything',
        growth: 'A small wish that becomes an adventure',
      },
    },
    openingPrompt: `You are GalWriter's story partner. Based on this creator taste profile:\n{profile}\n\nCreate exactly three sharply different visual-novel story openings. Each opening must have a title, world, plot direction, matchReason, and a 80-120 word opening scene. Respect the requested worldbuilding and plot direction. Do not create canvas cards yet. Return JSON only: {"openings":[{"title":"","world":"","plot":"","matchReason":"","opening":""}]}.`,
    generatePrompt: `Turn the selected opening into a GalWriter visual-novel starter. Creator taste:\n{profile}\n\nSelected opening:\n{opening}\n\nReturn character, scene, and 6-10 story cards. Give every card a short batchTitle that names its current part. Story cards must also use concise chapterTitle values to separate the world setup, relationship development, and plot escalation. The canvas will create a background region for every generated part.`,
    discussPrompt: `Keep discussing this selected story opening without creating canvas cards yet. Creator taste:\n{profile}\n\nSelected opening:\n{opening}\n\nUser message:\n{message}`,
    persistentContext: 'Saved creator taste:\n{profile}',
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
