/**
 * Subject Detection Utility
 * Automatically detects the subject of a homework problem based on keywords and patterns
 */

export type SubjectType = 'math' | 'chemistry' | 'physics' | 'biology' | 'bible' | 'languageArts' | 'geography' | 'history' | 'socialStudies' | 'law' | 'general';

interface SubjectDetectionResult {
  subject: SubjectType;
  confidence: number;
  needsVisualAid?: boolean; // For subjects like geography that may benefit from generated images
}

/**
 * Detects the subject of a problem based on text content
 * @param text - The problem text to analyze
 * @returns The detected subject and confidence level
 */
export function detectSubject(text: string): SubjectDetectionResult {
  const lowerText = text.toLowerCase();

  // Chemistry indicators (high priority)
  const chemistryKeywords = [
    'balance', 'equation', 'chemical', 'reaction', 'molecule', 'atom', 'element',
    'compound', 'ion', 'bond', 'acid', 'base', 'ph', 'mole', 'molarity',
    'oxidation', 'reduction', 'catalyst', 'reactant', 'product', 'solution',
    'concentration', 'electron', 'proton', 'neutron', 'periodic table',
    'combustion', 'synthesis', 'decomposition', 'displacement'
  ];

  // Chemistry formula patterns (e.g., H2O, CO2, NaCl, Fe2O3)
  const chemicalFormulaPattern = /\b[A-Z][a-z]?\d*(\([A-Z][a-z]?\d*\))?\d*\b/;
  const hasChemicalFormula = chemicalFormulaPattern.test(text);

  // Chemical arrows
  const hasChemicalArrow = text.includes('→') || text.includes('->') || text.includes('-->');

  // Physics indicators
  const physicsKeywords = [
    'force', 'velocity', 'acceleration', 'mass', 'energy', 'momentum', 'friction',
    'gravity', 'weight', 'speed', 'distance', 'displacement', 'motion', 'work',
    'power', 'torque', 'pressure', 'wave', 'frequency', 'amplitude', 'circuit',
    'voltage', 'current', 'resistance', 'magnetic', 'electric', 'field',
    'joule', 'newton', 'watt', 'meter', 'kilogram', 'second'
  ];

  // Biology indicators
  const biologyKeywords = [
    'cell', 'organism', 'tissue', 'organ', 'enzyme', 'protein', 'dna', 'rna',
    'gene', 'chromosome', 'mitosis', 'meiosis', 'photosynthesis', 'respiration',
    'evolution', 'natural selection', 'ecosystem', 'biome', 'species', 'taxonomy',
    'bacteria', 'virus', 'immune', 'antibody', 'homeostasis', 'metabolism',
    'ph balance', 'acidosis', 'alkalosis', 'buffer', 'bicarbonate', 'co2',
    'pco2', 'hco3', 'blood gas', 'respiratory', 'metabolic', 'compensation',
    'anatomy', 'physiology', 'genetics', 'heredity', 'allele', 'phenotype',
    'genotype', 'mutation', 'darwin', 'adaptation', 'habitat', 'niche'
  ];

  // Physics units (m/s, kg, N, J, etc.)
  const physicsUnitPattern = /\b(m\/s|kg|km\/h|mph|m\/s²|N|J|W|Pa|Hz|V|A|Ω)\b/i;
  const hasPhysicsUnit = physicsUnitPattern.test(text);

  // Bible indicators
  const bibleKeywords = [
    'bible', 'scripture', 'verse', 'testament', 'gospel', 'psalm', 'proverb',
    'chapter', 'book of', 'genesis', 'exodus', 'leviticus', 'matthew', 'mark',
    'luke', 'john', 'revelation', 'apostle', 'disciple', 'jesus', 'christ',
    'god', 'lord', 'prophet', 'king david', 'moses', 'abraham', 'paul',
    'covenant', 'commandment', 'parable', 'beatitude', 'sermon', 'crucifixion',
    'resurrection', 'biblical', 'israelite', 'pharisee', 'sadducee'
  ];

  // Bible verse patterns (e.g., John 3:16, Genesis 1:1-3)
  const bibleVersePattern = /\b(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs?|Ecclesiastes|Song|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation)\s+\d+:\d+/i;
  const hasBibleVerse = bibleVersePattern.test(text);

  // Language Arts indicators
  const languageArtsKeywords = [
    'essay', 'paragraph', 'thesis', 'argument', 'rhetorical', 'metaphor', 'simile',
    'alliteration', 'personification', 'hyperbole', 'imagery', 'symbolism', 'theme',
    'character', 'protagonist', 'antagonist', 'plot', 'setting', 'conflict',
    'foreshadowing', 'irony', 'tone', 'mood', 'point of view', 'narrator',
    'fiction', 'non-fiction', 'poetry', 'stanza', 'rhyme', 'meter', 'haiku',
    'sonnet', 'novel', 'short story', 'autobiography', 'biography', 'memoir',
    'grammar', 'syntax', 'noun', 'verb', 'adjective', 'adverb', 'subject',
    'predicate', 'clause', 'sentence', 'comma', 'semicolon', 'apostrophe',
    'quote', 'cite', 'citation', 'author', 'literary', 'analyze', 'interpretation'
  ];

  // Geography indicators
  const geographyKeywords = [
    'geography', 'map', 'continent', 'country', 'capital', 'city', 'ocean',
    'sea', 'river', 'mountain', 'valley', 'desert', 'forest', 'climate',
    'latitude', 'longitude', 'equator', 'hemisphere', 'tropic', 'arctic',
    'antarctic', 'population', 'density', 'urban', 'rural', 'region',
    'border', 'boundary', 'territory', 'province', 'state', 'peninsula',
    'island', 'archipelago', 'plateau', 'plain', 'canyon', 'delta',
    'glacier', 'volcano', 'earthquake', 'terrain', 'topography', 'atlas',
    'compass', 'direction', 'north', 'south', 'east', 'west', 'landmark',
    'locate', 'location', 'timezone', 'meridian', 'asia', 'africa', 'europe',
    'americas', 'australia', 'pacific', 'atlantic', 'indian ocean'
  ];

  // History indicators
  const historyKeywords = [
    'history', 'historical', 'century', 'era', 'period', 'ancient', 'medieval',
    'renaissance', 'revolution', 'war', 'battle', 'empire', 'kingdom', 'dynasty',
    'colonial', 'independence', 'treaty', 'declaration', 'constitution', 'amendment',
    'president', 'king', 'queen', 'emperor', 'pharaoh', 'civiliz', 'culture',
    'trade route', 'migration', 'settlement', 'expedition', 'exploration',
    'industrial revolution', 'world war', 'civil war', 'cold war', 'reform',
    'movement', 'rebellion', 'uprising', 'conquest', 'invasion', 'slavery',
    'abolition', 'suffrage', 'depression', 'renaissance', 'enlightenment',
    'reconstruction', 'progressive', 'imperialism', 'nationalism', 'populist',
    'gilded age', 'roaring twenties', 'great depression', 'new deal',
    'primary source', 'secondary source', 'artifact', 'timeline', 'chronological'
  ];

  // Social Studies indicators
  const socialStudiesKeywords = [
    'political', 'government', 'democracy', 'republic', 'citizen', 'citizenship',
    'voting', 'election', 'campaign', 'policy', 'legislation', 'congress',
    'senate', 'judicial', 'executive', 'legislative', 'checks and balances',
    'political socialization', 'political behavior', 'activism', 'civic engagement',
    'town hall', 'gerrymandering', 'federalism', 'fiscal policy', 'monetary policy',
    'economic system', 'capitalism', 'socialism', 'market economy', 'gdp',
    'inflation', 'unemployment', 'supply and demand', 'taxation', 'budget',
    'civil rights', 'civil liberties', 'bill of rights', 'constitution',
    'sovereignty', 'diplomacy', 'foreign policy', 'domestic policy', 'ideology',
    'political party', 'conservative', 'liberal', 'moderate', 'bipartisan',
    'lobby', 'interest group', 'public opinion', 'media influence', 'propaganda',
    'social justice', 'equity', 'equality', 'discrimination', 'segregation',
    'civil disobedience', 'protest', 'social movement', 'advocacy'
  ];

  // Law indicators
  const lawKeywords = [
    'law', 'legal', 'statute', 'court', 'case', 'plaintiff', 'defendant', 'litigation',
    'contract', 'tort', 'criminal', 'civil', 'justice', 'judge', 'jury', 'trial',
    'liability', 'damages', 'negligence', 'breach', 'constitutional', 'supreme court',
    'appellate', 'jurisdiction', 'precedent', 'attorney', 'counsel', 'testimony',
    'verdict', 'ruling', 'legal doctrine', 'due process', 'evidence', 'objection',
    'prosecution', 'defense', 'conviction', 'acquittal', 'sentence', 'appeal',
    'common law', 'statutory', 'ordinance', 'regulation', 'amendment', 'lawsuit',
    'judicial review', 'magistrate', 'probate', 'injunction', 'subpoena', 'deposition',
    'affidavit', 'pleading', 'brief', 'motion', 'discovery', 'settlement'
  ];

  // Geography location patterns
  const hasLocationQuery = /\b(where is|locate|location of|capital of|borders of|map of)\b/i.test(lowerText);

  // Math indicators (default fallback)
  const mathKeywords = [
    'solve', 'simplify', 'factor', 'expand', 'calculate', 'evaluate', 'find',
    'graph', 'plot', 'derivative', 'integral', 'limit', 'matrix', 'vector',
    'polynomial', 'quadratic', 'linear', 'exponential', 'logarithm', 'trigonometric',
    'sine', 'cosine', 'tangent', 'angle', 'triangle', 'circle', 'area', 'volume',
    'perimeter', 'diameter', 'radius', 'slope', 'intercept'
  ];

  // Count keyword matches
  let chemistryScore = 0;
  let physicsScore = 0;
  let biologyScore = 0;
  let bibleScore = 0;
  let languageArtsScore = 0;
  let geographyScore = 0;
  let historyScore = 0;
  let socialStudiesScore = 0;
  let lawScore = 0;
  let mathScore = 0;

  chemistryKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) chemistryScore++;
  });

  physicsKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) physicsScore++;
  });

  biologyKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) biologyScore++;
  });

  bibleKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) bibleScore++;
  });

  languageArtsKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) languageArtsScore++;
  });

  geographyKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) geographyScore++;
  });

  historyKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) historyScore++;
  });

  socialStudiesKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) socialStudiesScore++;
  });

  lawKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) lawScore++;
  });

  mathKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) mathScore++;
  });

  // Boost scores based on pattern matches
  if (hasChemicalFormula) chemistryScore += 3;
  if (hasChemicalArrow) chemistryScore += 2;
  if (hasPhysicsUnit) physicsScore += 3;
  if (hasBibleVerse) bibleScore += 4;
  if (hasLocationQuery) geographyScore += 3;

  // Determine subject
  const maxScore = Math.max(chemistryScore, physicsScore, biologyScore, bibleScore, languageArtsScore, geographyScore, historyScore, socialStudiesScore, lawScore, mathScore);

  if (maxScore === 0) {
    return { subject: 'general', confidence: 0.5 };
  }

  if (biologyScore === maxScore && biologyScore > 0) {
    return {
      subject: 'biology',
      confidence: Math.min(0.9, 0.5 + (biologyScore * 0.1))
    };
  }

  if (socialStudiesScore === maxScore && socialStudiesScore > 0) {
    return {
      subject: 'socialStudies',
      confidence: Math.min(0.9, 0.5 + (socialStudiesScore * 0.1))
    };
  }

  if (lawScore === maxScore && lawScore > 0) {
    return {
      subject: 'law',
      confidence: Math.min(0.9, 0.5 + (lawScore * 0.1))
    };
  }

  if (historyScore === maxScore && historyScore > 0) {
    return {
      subject: 'history',
      confidence: Math.min(0.9, 0.5 + (historyScore * 0.1))
    };
  }

  if (geographyScore === maxScore && geographyScore > 0) {
    return {
      subject: 'geography',
      confidence: Math.min(0.9, 0.5 + (geographyScore * 0.1)),
      needsVisualAid: hasLocationQuery || lowerText.includes('map') // Suggest visual aid for location queries
    };
  }

  if (bibleScore === maxScore && bibleScore > 0) {
    return {
      subject: 'bible',
      confidence: Math.min(0.9, 0.5 + (bibleScore * 0.1))
    };
  }

  if (languageArtsScore === maxScore && languageArtsScore > 0) {
    return {
      subject: 'languageArts',
      confidence: Math.min(0.9, 0.5 + (languageArtsScore * 0.1))
    };
  }

  if (chemistryScore === maxScore && chemistryScore > 0) {
    return {
      subject: 'chemistry',
      confidence: Math.min(0.9, 0.5 + (chemistryScore * 0.1))
    };
  }

  if (physicsScore === maxScore && physicsScore > 0) {
    return {
      subject: 'physics',
      confidence: Math.min(0.9, 0.5 + (physicsScore * 0.1))
    };
  }

  if (mathScore === maxScore && mathScore > 0) {
    return {
      subject: 'math',
      confidence: Math.min(0.9, 0.5 + (mathScore * 0.1))
    };
  }

  return { subject: 'math', confidence: 0.6 }; // Default to math
}

/**
 * Gets subject-specific formatting instructions for AI prompts
 */
export function getSubjectFormattingRules(subject: SubjectType): string {
  const baseRules = `
1. **Fractions - MANDATORY VERTICAL FORMAT - ABSOLUTELY CRITICAL**:
   - **ALWAYS use**: {numerator/denominator} syntax for ALL fractions
   - **NEVER use**: "1/2", "3/4", "x/2", "5/8" (these display as ugly inline text)
   - **NEVER use**: "½", "¾", "⅓" (typography fractions are FORBIDDEN)
   - **NEVER use**: slash notation, inline division, or "÷" symbol for fractions
   - Examples of CORRECT usage:
     * Write {6/7} NOT "6/7" or "six sevenths"
     * Write {1/2} NOT "1/2" or "½" or "half"
     * Write {x/2} NOT "x/2" or "x÷2"
     * Write {-3/4} NOT "-3/4" or "negative three fourths"
   - If you see ANY fraction in your response that is not wrapped in {}, FIX IT IMMEDIATELY
   - The {num/den} format displays as beautiful vertical fractions with professional appearance

2. **Multiplication Symbol**: ALWAYS use × for multiplication, NEVER use *`;

  const chemistryRules = `
3. **Chemical Notation**:
   - Subscripts: Use _subscript_ format, e.g., H_2_O, Fe_2_O_3_, CO_2_
   - Superscripts: Use ^superscript^ format, e.g., Ca^2+^, Al^3+^
   - Chemical arrows: Use → to show reactions
   - Coefficients: Place before formulas, e.g., 2H_2_O means two water molecules
   - **CRITICAL LINE BREAKS**: Keep chemical equations on ONE LINE - write "2H_2_ + O_2_ → 2H_2_O" as a continuous expression
   - Write explanations AFTER the complete equation, not breaking it apart

4. **Visual Diagrams for Chemistry**:
   - Most chemistry problems do NOT need diagrams
   - EXCEPTION: Include diagrams for acid-base abnormalities, pH relationships, or buffer systems where visual representation helps understand the concept
   - Example when diagram IS helpful: "[IMAGE NEEDED: diagram showing normal pH range 7.35-7.45, with arrows indicating acidosis (pH < 7.35) and alkalosis (pH > 7.45), and compensatory mechanisms]"
   - Only create diagrams when they genuinely aid conceptual understanding

5. **Color Highlighting for Chemistry**:
   - Use colors MODERATELY for chemistry - only when showing balancing or atom counting
   - [red:coefficients being changed]
   - [blue:atoms being counted]
   - Keep explanatory text plain without excessive highlighting`;

  const physicsRules = `
3. **Physics Notation**:
   - Units: Keep units with values, e.g., "15 m/s", "9.8 m/s²", "50 N"
   - Vectors: Use bold or arrow notation, e.g., [blue:v→] or [blue:F→]
   - Subscripts: Use _subscript_ for variables, e.g., v_i_ (initial velocity), F_net_
   - Equations: Show formula → substitution → result

4. **Color Highlighting for Physics**:
   - [red:known values]
   - [blue:unknown values]
   - [green:final answer with units]`;

  const biologyRules = `
3. **Biology Formatting**:
   - Scientific names: Italicize genus and species (e.g., *Homo sapiens*)
   - Use proper terminology: phenotype, genotype, allele, chromosome, etc.
   - Chemical notation: Use subscripts for chemical formulas (H_2_O, CO_2_, HCO_3_^-^)
   - pH and blood gas values: Be precise with units (pH, PaCO_2_ in mmHg, HCO_3_^-^ in mEq/L)

4. **Visual Diagrams for Biology**:
   - Most biology problems do NOT need diagrams
   - EXCEPTION: Include diagrams for acid-base abnormalities, pH balance, homeostatic mechanisms, or buffer systems
   - Example when diagram IS helpful: "[IMAGE NEEDED: diagram showing normal pH range 7.35-7.45, with arrows indicating acidosis (pH < 7.35) and alkalosis (pH > 7.45), showing respiratory vs metabolic causes and compensation mechanisms]"
   - Also helpful for cell cycles, genetic crosses (Punnett squares), or anatomical relationships
   - Only create diagrams when they genuinely aid conceptual understanding

5. **Color Highlighting for Biology**:
   - Use colors SPARINGLY - only for key terms or final answers
   - [red:abnormal values or final diagnosis]
   - [blue:normal reference ranges]
   - Keep most explanatory text plain`;

  const mathRules = `
3. **Strategic Color Highlighting AND Intermediate Step Display**:
   - For EVERY operation, show equation WITH operation being performed
   - Highlight ONLY terms being operated on in RED (left side of arrow)
   - Add arrow → to show result
   - After arrow, show simplified equation in PLAIN BLACK TEXT
   - Format: "[equation with [red:terms]] → [plain black result]"

4. **Color Usage**:
   - RED: Terms being eliminated or operated on
   - Results after → should be plain black
   - Exception: Final answers can be highlighted`;

  const bibleRules = `
3. **Biblical Formatting**:
   - Verse references: Book Chapter:Verse format (e.g., John 3:16, Genesis 1:1-3)
   - Names and places: Capitalize properly (Jerusalem, Galilee, Peter, Paul)
   - Quotes: Use quotation marks for direct scripture quotes
   - Context: Provide historical/cultural context when relevant

4. **CRITICAL - Keep It Clear for Bible Study**:
   - Bible questions often need THOUGHTFUL but DIRECT answers
   - Use color highlighting SPARINGLY - only for truly important theological terms
   - Keep responses focused and avoid unnecessary tangents
   - Balance depth with clarity - be thorough but not verbose
   - Example: If asked about a verse meaning, explain it clearly without excessive elaboration`;

  const languageArtsRules = `
3. **Language Arts Formatting**:
   - Literary devices: Can identify with minimal highlighting like [blue:metaphor]
   - Quotes: Use proper quotation marks with attribution
   - Grammar terms: Italicize or highlight parts of speech being discussed
   - Essay structure: Use clear headings (Introduction, Body, Conclusion)
   - Citations: Include author and work title when analyzing literature

4. **CRITICAL - Keep It Clear for Language Arts**:
   - Language Arts questions often need EXPLANATORY but FOCUSED answers
   - Use color highlighting SPARINGLY - only when identifying specific literary devices or grammar elements
   - Keep responses clear and avoid overly verbose analysis
   - Balance literary insight with accessibility
   - Example: If asked about a literary device, explain it clearly with brief examples`;

  const geographyRules = `
3. **Geography Formatting**:
   - Locations: Always capitalize properly (Paris, France; Amazon River; Mount Everest)
   - Coordinates: Use degree symbols (40.7128°N, 74.0060°W)
   - Directions: Use cardinal directions (North, South, East, West)
   - Numbers: Include units (5,280 km², 3.8 million people)
   - **VISUAL AIDS**: When discussing locations, borders, or spatial relationships, note "[IMAGE NEEDED: map of X]" to indicate where a generated map would be helpful

4. **CRITICAL - Keep It Simple for Geography**:
   - Geography questions usually need DIRECT, FACTUAL answers
   - AVOID color highlighting unless absolutely critical (use very sparingly)
   - Keep responses BRIEF and to the point - simple questions deserve simple answers
   - Do NOT add unnecessary context or wordy explanations
   - Example: "Which countries border Slovakia?" → Just list them clearly, no need for elaborate explanations about Central Europe
   - If highlighting is needed, use ONLY for the most important terms (once per answer maximum)`;

  const historyRules = `
3. **History Formatting**:
   - Dates and periods: Be specific (1865, 19th century, Gilded Age, Progressive Era)
   - Events and movements: Capitalize properly (American Revolution, Populist Movement, Thirteenth Amendment)
   - People: Include full names and titles when relevant (President Abraham Lincoln, Queen Victoria)
   - Analysis: Focus on cause-and-effect relationships and historical context
   - **NO DIAGRAMS NEEDED**: History questions rarely benefit from visual diagrams unless discussing maps, timelines, or battle formations

4. **CRITICAL - Keep It Clear for History**:
   - History questions need ANALYTICAL but FOCUSED answers
   - AVOID unnecessary diagrams - most history questions are text-based analysis
   - Use color highlighting SPARINGLY - only for key events, dates, or conclusions
   - When listing multiple historical developments or options (A, B, C, D), put EACH on its own line
   - Keep responses clear and well-organized with proper line breaks
   - Example: When analyzing which development matches a historical context, list each option on a separate line for readability`;

  const socialStudiesRules = `
3. **Social Studies Formatting**:
   - Concepts: Capitalize properly (Political Socialization, Federalism, Gerrymandering, Fiscal Policy)
   - Government terms: Be precise (legislative branch, checks and balances, judicial review)
   - Analysis: Focus on explaining concepts, relationships, and real-world applications
   - **NO DIAGRAMS NEEDED**: Social studies questions rarely need visual diagrams - they're primarily conceptual analysis

4. **CRITICAL - Multiple Choice Questions**:
   - For multiple choice questions, you MUST analyze ALL answer choices
   - Create a dedicated step titled "Analyze Each Answer Choice" or "Evaluate All Options"
   - List EACH option (A, B, C, D) on its own line with brief explanation
   - Explain why the correct answer is right AND why the others are wrong
   - Format the final answer as: "[red:A. Political Socialization]" (include the letter AND the answer text)
   - Example step format:
     "A. Political Socialization - Correct because it explains how citizens learn political behaviors across generations.
     B. Gerrymandering - Incorrect, this relates to electoral district manipulation, not behavioral shifts.
     C. Federalism - Incorrect, this describes power distribution between government levels.
     D. Fiscal Policy - Incorrect, this refers to government taxation and spending policies."

5. **General Social Studies Guidelines**:
   - Use color highlighting SPARINGLY - only for key concepts or the final answer
   - AVOID creating diagrams unless specifically about organizational charts or government structures
   - Keep responses clear, analytical, and well-organized
   - Focus on explaining WHY concepts apply, not just stating facts`;

  const lawRules = `
3. **Law Formatting**:
   - Legal terms: Capitalize properly (Supreme Court, Due Process, Constitutional Law, Common Law)
   - Case names: Italicize and use proper format (*Brown v. Board of Education*, *Roe v. Wade*)
   - Citations: Include court and year when relevant (U.S. Supreme Court, 1954)
   - Terminology: Be precise with legal language (plaintiff/defendant, tort/contract, civil/criminal)
   - **NO DIAGRAMS NEEDED**: Law questions are analytical and text-based - diagrams are rarely helpful

4. **CRITICAL - Multiple Choice Questions**:
   - For multiple choice questions, you MUST analyze ALL answer choices
   - Create a dedicated step titled "Analyze Each Answer Choice" or "Evaluate All Options"
   - List EACH option (A, B, C, D) on its own line with brief explanation
   - Explain why the correct answer is right AND why the others are wrong
   - Format the final answer as: "[red:A. Due Process]" (include the letter AND the answer text)
   - Example step format:
     "A. Due Process - Correct because it protects against arbitrary government action.
     B. Equal Protection - Incorrect, this addresses discrimination rather than procedural fairness.
     C. Free Speech - Incorrect, this relates to First Amendment rights.
     D. Cruel and Unusual Punishment - Incorrect, this is an Eighth Amendment protection."

5. **General Law Guidelines**:
   - Use color highlighting SPARINGLY - only for key legal terms or the final answer
   - NEVER create diagrams for law questions - they are conceptual and analytical
   - Keep responses clear, precise, and well-reasoned
   - Focus on legal analysis and application of legal principles
   - Explain WHY legal concepts apply, citing relevant doctrines or precedents when helpful`;

  const generalRules = `
3. **General Formatting**:
   - Use colors strategically: [red:important], [blue:key terms], [green:answers]
   - Show step-by-step work with arrows →
   - Keep formatting clean and consistent`;

  switch (subject) {
    case 'chemistry':
      return baseRules + chemistryRules;
    case 'physics':
      return baseRules + physicsRules;
    case 'biology':
      return baseRules + biologyRules;
    case 'math':
      return baseRules + mathRules;
    case 'bible':
      return baseRules + bibleRules;
    case 'languageArts':
      return baseRules + languageArtsRules;
    case 'geography':
      return baseRules + geographyRules;
    case 'history':
      return baseRules + historyRules;
    case 'socialStudies':
      return baseRules + socialStudiesRules;
    case 'law':
      return baseRules + lawRules;
    default:
      return baseRules + generalRules;
  }
}
