import { Question, GameSettings } from '../types';

export const DEFAULT_CATEGORIES: string[] = [
  'Marketing',
  'PreSales',
  'Proposals',
  'Guardian',
  'Digital'
];

export const DEFAULT_STAGE_DESCRIPTIONS: Record<string, string> = {
  Marketing: 'Marketing creates awareness, understands audiences, and helps the right customers discover relevant capabilities.',
  PreSales: 'PreSales validates technical feasibility, aligns architecture with customer needs, and proves solution capability.',
  Proposals: 'Proposals crafts tailored commercial frameworks, aligns scope and pricing, and secures formal agreements.',
  Guardian: 'Guardian ensures client trust, information security compliance, governance, and long-term customer success.',
  Digital: 'Digital drives API integration, automated platform adoption, and seamless operational excellence.'
};

export const DEFAULT_SETTINGS: GameSettings = {
  questionsPerGame: 5,
  timerSeconds: 30,
  randomSelection: false,
  shuffleQuestions: false,
  shuffleAnswers: true,
  allowNegativePoints: false,
  categories: DEFAULT_CATEGORIES,
  defaultPointsPerQuestion: 20,
  competitionMode: true
};

export const DEFAULT_QUESTIONS: Question[] = [
  // =========================================================================
  // 01 Marketing - Stage 1 (Shuffled 20, 15, 10, 5 scoring)
  // =========================================================================
  {
    id: 'quest-mkt-01',
    text: "Apex Industries is exploring ways to improve its operations. Your team has one chance to make a relevant first impression.",
    stageDescription: "Marketing creates awareness, understands audiences, and helps the right customers discover relevant capabilities.",
    options: [
      "Send a generic company brochure",
      "Share a targeted industry case study",
      "Send an executive overview email with relevant industry benchmarks",
      "Send a formal proposal immediately"
    ],
    optionScores: {
      "Share a targeted industry case study": 20,
      "Send an executive overview email with relevant industry benchmarks": 15,
      "Send a generic company brochure": 10,
      "Send a formal proposal immediately": 5
    },
    correctAnswer: "Share a targeted industry case study",
    explanation: "A targeted industry case study demonstrates proven relevance to their operational challenges without jumping prematurely to commercial contracts or relying on generic marketing collateral.",
    category: "Marketing",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-mkt-02',
    text: "Apex's VP of Operations downloads our enterprise whitepaper. What is the optimal next marketing trigger to advance their journey?",
    stageDescription: "Marketing creates awareness, understands audiences, and helps the right customers discover relevant capabilities.",
    options: [
      "Send a relevant follow-up case study highlighting quantifiable operational efficiency gains",
      "Send a standard automated confirmation receipt with generic product links",
      "Schedule an uncoordinated generic discovery call",
      "Have a sales rep immediately call their personal mobile phone multiple times"
    ],
    optionScores: {
      "Send a relevant follow-up case study highlighting quantifiable operational efficiency gains": 20,
      "Send a standard automated confirmation receipt with generic product links": 15,
      "Schedule an uncoordinated generic discovery call": 10,
      "Have a sales rep immediately call their personal mobile phone multiple times": 5
    },
    correctAnswer: "Send a relevant follow-up case study highlighting quantifiable operational efficiency gains",
    explanation: "Contextual nurture campaigns that reinforce business outcomes build trust faster than aggressive cold-calling.",
    category: "Marketing",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-mkt-03',
    text: "Apex Industries engages with three consecutive thought-leadership posts on LinkedIn. How should marketing score and handle this lead?",
    stageDescription: "Marketing creates awareness, understands audiences, and helps the right customers discover relevant capabilities.",
    options: [
      "Down-rank the account because social media interactions indicate low purchase intent",
      "Track engagement silently in analytics without proactive outreach",
      "Send a direct sales pitch message via LinkedIn InMail",
      "Elevate lead score to 'Marketing Qualified Lead' (MQL) and trigger tailored solution briefing"
    ],
    optionScores: {
      "Elevate lead score to 'Marketing Qualified Lead' (MQL) and trigger tailored solution briefing": 20,
      "Send a direct sales pitch message via LinkedIn InMail": 15,
      "Track engagement silently in analytics without proactive outreach": 10,
      "Down-rank the account because social media interactions indicate low purchase intent": 5
    },
    correctAnswer: "Elevate lead score to 'Marketing Qualified Lead' (MQL) and trigger tailored solution briefing",
    explanation: "Multiple executive engagements across content pieces signal active discovery and warrant an upgraded lead status.",
    category: "Marketing",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-mkt-04',
    text: "Which marketing KPI most accurately indicates that Apex Industries' buying committee is genuinely aligned with our brand?",
    stageDescription: "Marketing creates awareness, understands audiences, and helps the right customers discover relevant capabilities.",
    options: [
      "Single-user whitepaper downloads from a personal email address",
      "Multi-stakeholder content consumption across business, security, and technical pillars",
      "Total visits to the pricing page from company IP address",
      "Raw page-view counts by anonymous web crawlers"
    ],
    optionScores: {
      "Multi-stakeholder content consumption across business, security, and technical pillars": 20,
      "Total visits to the pricing page from company IP address": 15,
      "Single-user whitepaper downloads from a personal email address": 10,
      "Raw page-view counts by anonymous web crawlers": 5
    },
    correctAnswer: "Multi-stakeholder content consumption across business, security, and technical pillars",
    explanation: "Enterprise decisions are made by multi-disciplinary committees; cross-functional engagement is the strongest buying signal.",
    category: "Marketing",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // =========================================================================
  // 02 PreSales - Stage 2 (Shuffled 20, 15, 10, 5 scoring)
  // =========================================================================
  {
    id: 'quest-ps-01',
    text: "During the initial technical discovery session with Apex Industries' CTO, what is the primary objective of the PreSales Architect?",
    stageDescription: "PreSales validates technical feasibility, aligns architecture with customer needs, and proves solution capability.",
    options: [
      "Demonstrate standard off-the-shelf features without asking about customer infrastructure",
      "Deliver an overview slide deck highlighting generic product modules",
      "Uncover underlying architecture pain points, data flow constraints, and strategic business goals",
      "Rush straight into contract pricing without understanding system requirements"
    ],
    optionScores: {
      "Uncover underlying architecture pain points, data flow constraints, and strategic business goals": 20,
      "Deliver an overview slide deck highlighting generic product modules": 15,
      "Demonstrate standard off-the-shelf features without asking about customer infrastructure": 10,
      "Rush straight into contract pricing without understanding system requirements": 5
    },
    correctAnswer: "Uncover underlying architecture pain points, data flow constraints, and strategic business goals",
    explanation: "Effective PreSales begins with deep consultative discovery to align technological capabilities with the customer's core challenges.",
    category: "PreSales",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-ps-02',
    text: "Apex Industries asks if our platform can support 100,000 concurrent transactions with sub-second latency. How should PreSales respond?",
    stageDescription: "PreSales validates technical feasibility, aligns architecture with customer needs, and proves solution capability.",
    options: [
      "Provide validated performance stress-test benchmarks, reference architectures, and client case studies",
      "Share theoretical capacity specifications from standard product documentation",
      "Offer to arrange a future meeting with backend engineers to check capacity",
      "Give an immediate verbal guarantee without verifying backend capacity"
    ],
    optionScores: {
      "Provide validated performance stress-test benchmarks, reference architectures, and client case studies": 20,
      "Share theoretical capacity specifications from standard product documentation": 15,
      "Offer to arrange a future meeting with backend engineers to check capacity": 10,
      "Give an immediate verbal guarantee without verifying backend capacity": 5
    },
    correctAnswer: "Provide validated performance stress-test benchmarks, reference architectures, and client case studies",
    explanation: "Trust is built on verifiable technical proof, documented benchmarks, and proven production scalability.",
    category: "PreSales",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-ps-03',
    text: "When conducting a Proof of Concept (PoC) with Apex Industries, what is essential for ensuring a decisive win?",
    stageDescription: "PreSales validates technical feasibility, aligns architecture with customer needs, and proves solution capability.",
    options: [
      "Conduct open-ended exploratory testing sessions without formal milestones",
      "Allow testing of arbitrary features requested during informal calls",
      "Agree in advance on 3-5 clearly measurable, objective success criteria with explicit sign-off milestones",
      "Provide a demo sandbox environment with guided test scripts"
    ],
    optionScores: {
      "Agree in advance on 3-5 clearly measurable, objective success criteria with explicit sign-off milestones": 20,
      "Provide a demo sandbox environment with guided test scripts": 15,
      "Conduct open-ended exploratory testing sessions without formal milestones": 10,
      "Allow testing of arbitrary features requested during informal calls": 5
    },
    correctAnswer: "Agree in advance on 3-5 clearly measurable, objective success criteria with explicit sign-off milestones",
    explanation: "A structured PoC with pre-agreed evaluation criteria prevents scope creep and leads directly to commercial approval.",
    category: "PreSales",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-ps-04',
    text: "Apex asks for an architectural integration with their legacy on-premise mainframe. What is the recommended PreSales stance?",
    stageDescription: "PreSales validates technical feasibility, aligns architecture with customer needs, and proves solution capability.",
    options: [
      "Suggest third-party middleware tools without native integration support",
      "Demonstrate our secure hybrid gateway and pre-built connector patterns with clear data mapping",
      "Offer custom API scripting services to bridge mainframe endpoints",
      "Refuse to support any on-premise infrastructure"
    ],
    optionScores: {
      "Demonstrate our secure hybrid gateway and pre-built connector patterns with clear data mapping": 20,
      "Offer custom API scripting services to bridge mainframe endpoints": 15,
      "Suggest third-party middleware tools without native integration support": 10,
      "Refuse to support any on-premise infrastructure": 5
    },
    correctAnswer: "Demonstrate our secure hybrid gateway and pre-built connector patterns with clear data mapping",
    explanation: "Enterprise customers rely on hybrid continuity; presenting clear gateway patterns establishes credibility.",
    category: "PreSales",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // =========================================================================
  // 03 Proposals - Stage 3 (Shuffled 20, 15, 10, 5 scoring)
  // =========================================================================
  {
    id: 'quest-prop-01',
    text: "When drafting the Executive Summary for Apex Industries' multi-million dollar proposal, what should lead the narrative?",
    stageDescription: "Proposals crafts tailored commercial frameworks, aligns scope and pricing, and secures formal agreements.",
    options: [
      "A high-level summary of software feature lists and licensing tiers",
      "A summary of technological capabilities and system architecture",
      "A 10-page detailed history of our company's founding date and organizational hierarchy",
      "Apex Industries' strategic objectives, business impact, and measurable return on investment"
    ],
    optionScores: {
      "Apex Industries' strategic objectives, business impact, and measurable return on investment": 20,
      "A summary of technological capabilities and system architecture": 15,
      "A high-level summary of software feature lists and licensing tiers": 10,
      "A 10-page detailed history of our company's founding date and organizational hierarchy": 5
    },
    correctAnswer: "Apex Industries' strategic objectives, business impact, and measurable return on investment",
    explanation: "Executive decision-makers focus on their strategic ROI and business transformation, not generic supplier biographies.",
    category: "Proposals",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-prop-02',
    text: "Apex's procurement team requests an aggressive 30% discount. What is the most strategic proposal counter-offer to preserve margin and value?",
    stageDescription: "Proposals crafts tailored commercial frameworks, aligns scope and pricing, and secures formal agreements.",
    options: [
      "Offer multi-year commitment terms or adjusted deployment phasing in exchange for volume concessions",
      "Offer a standard 10% discount without adjusting contract duration or scope",
      "Reduce implementation consulting hours to lower the bottom-line cost",
      "Instantly grant the 30% discount without requesting any contract term concessions"
    ],
    optionScores: {
      "Offer multi-year commitment terms or adjusted deployment phasing in exchange for volume concessions": 20,
      "Offer a standard 10% discount without adjusting contract duration or scope": 15,
      "Reduce implementation consulting hours to lower the bottom-line cost": 10,
      "Instantly grant the 30% discount without requesting any contract term concessions": 5
    },
    correctAnswer: "Offer multi-year commitment terms or adjusted deployment phasing in exchange for volume concessions",
    explanation: "Negotiating on terms, duration, and scope protects commercial profitability while demonstrating partnership flexibility.",
    category: "Proposals",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-prop-03',
    text: "Apex requests customized Service Level Agreements (SLAs) with 99.99% uptime. How should the Proposals team structure the commitment?",
    stageDescription: "Proposals crafts tailored commercial frameworks, aligns scope and pricing, and secures formal agreements.",
    options: [
      "Offer the default 99.9% SLA tier without financial remedy schedules",
      "Validate SLA feasibility with Engineering, define maintenance windows, and tie credits to clear tiered parameters",
      "Commit to 99.95% uptime with standard support credits",
      "Accept 100% uptime with unlimited financial liability without engineering review"
    ],
    optionScores: {
      "Validate SLA feasibility with Engineering, define maintenance windows, and tie credits to clear tiered parameters": 20,
      "Commit to 99.95% uptime with standard support credits": 15,
      "Offer the default 99.9% SLA tier without financial remedy schedules": 10,
      "Accept 100% uptime with unlimited financial liability without engineering review": 5
    },
    correctAnswer: "Validate SLA feasibility with Engineering, define maintenance windows, and tie credits to clear tiered parameters",
    explanation: "A robust proposal balances realistic technical operational capacity with legally sound and reassuring commitments.",
    category: "Proposals",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-prop-04',
    text: "Which element in Apex Industries' commercial proposal ensures seamless post-signature transition to implementation?",
    stageDescription: "Proposals crafts tailored commercial frameworks, aligns scope and pricing, and secures formal agreements.",
    options: [
      "A single line stating 'Delivery dates to be determined after payment'",
      "A clear Responsibility Assignment Matrix (RACI) and detailed 90-day milestone rollout roadmap",
      "A detailed list of implementation deliverables and resource expectations",
      "A generalized onboarding guide with generic target completion quarters"
    ],
    optionScores: {
      "A clear Responsibility Assignment Matrix (RACI) and detailed 90-day milestone rollout roadmap": 20,
      "A detailed list of implementation deliverables and resource expectations": 15,
      "A generalized onboarding guide with generic target completion quarters": 10,
      "A single line stating 'Delivery dates to be determined after payment'": 5
    },
    correctAnswer: "A clear Responsibility Assignment Matrix (RACI) and detailed 90-day milestone rollout roadmap",
    explanation: "Clear accountability and defined milestone roadmaps prevent post-sale friction and foster confidence.",
    category: "Proposals",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // =========================================================================
  // 04 Guardian - Stage 4 (Shuffled 20, 15, 10, 5 scoring)
  // =========================================================================
  {
    id: 'quest-guard-01',
    text: "Contract signed! Apex Industries moves to Day 1 onboarding. What is the Guardian (Customer Success & Advocacy) team's top priority?",
    stageDescription: "Guardian ensures client trust, information security compliance, governance, and long-term customer success.",
    options: [
      "Send a welcome email with access links and wait for the client to schedule questions",
      "Host a structured kickoff, align success metrics, establish governance cadences, and secure early quick wins",
      "Schedule bi-weekly check-in calls with the client project lead",
      "Hand off a 500-page manual and disappear until the annual contract renewal date"
    ],
    optionScores: {
      "Host a structured kickoff, align success metrics, establish governance cadences, and secure early quick wins": 20,
      "Schedule bi-weekly check-in calls with the client project lead": 15,
      "Send a welcome email with access links and wait for the client to schedule questions": 10,
      "Hand off a 500-page manual and disappear until the annual contract renewal date": 5
    },
    correctAnswer: "Host a structured kickoff, align success metrics, establish governance cadences, and secure early quick wins",
    explanation: "The first 30 days dictate customer retention. Early momentum and aligned governance solidify trust.",
    category: "Guardian",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-guard-02',
    text: "Apex's security auditor issues an emergency SOC 2 and GDPR compliance audit query. How does the Guardian team protect trust?",
    stageDescription: "Guardian ensures client trust, information security compliance, governance, and long-term customer success.",
    options: [
      "Promptly provide verified SOC 2 Type II reports, security whitepapers, and direct access to compliance officers",
      "Provide standard security architecture overview documentation",
      "Refer the auditor to public FAQ articles without official compliance attestations",
      "Dismiss the audit request as unnecessary bureaucracy"
    ],
    optionScores: {
      "Promptly provide verified SOC 2 Type II reports, security whitepapers, and direct access to compliance officers": 20,
      "Provide standard security architecture overview documentation": 15,
      "Refer the auditor to public FAQ articles without official compliance attestations": 10,
      "Dismiss the audit request as unnecessary bureaucracy": 5
    },
    correctAnswer: "Promptly provide verified SOC 2 Type II reports, security whitepapers, and direct access to compliance officers",
    explanation: "Transparent, rapid, and authoritative compliance verification reassures enterprise risk management teams.",
    category: "Guardian",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-guard-03',
    text: "Six months into production, Apex submits a critical Severity-1 issue impacting user workflows. What is the correct Guardian protocol?",
    stageDescription: "Guardian ensures client trust, information security compliance, governance, and long-term customer success.",
    options: [
      "Log the ticket into standard support queue with 24-hour turnaround",
      "Notify senior engineering and provide hourly written status updates",
      "Downgrade the ticket priority so internal SLA metrics are not breached",
      "Acknowledge immediately, open bridge with incident engineering, provide 30-min status cadences, and conduct a Root Cause Analysis (RCA)"
    ],
    optionScores: {
      "Acknowledge immediately, open bridge with incident engineering, provide 30-min status cadences, and conduct a Root Cause Analysis (RCA)": 20,
      "Notify senior engineering and provide hourly written status updates": 15,
      "Log the ticket into standard support queue with 24-hour turnaround": 10,
      "Downgrade the ticket priority so internal SLA metrics are not breached": 5
    },
    correctAnswer: "Acknowledge immediately, open bridge with incident engineering, provide 30-min status cadences, and conduct a Root Cause Analysis (RCA)",
    explanation: "During critical incidents, proactive communication, rapid triage, and blameless post-mortems preserve customer loyalty.",
    category: "Guardian",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-guard-04',
    text: "To proactively safeguard account health and prevent churn, how should the Guardian team conduct Executive Business Reviews (EBRs)?",
    stageDescription: "Guardian ensures client trust, information security compliance, governance, and long-term customer success.",
    options: [
      "Semi-annual executive presentations reviewing contract utilization metrics",
      "Quarterly sessions highlighting verified ROI outcomes, health scores, and collaborative future roadmaps",
      "Annual check-in meeting reviewing invoice totals and renewal terms",
      "Only when the contract is 10 days away from expiration"
    ],
    optionScores: {
      "Quarterly sessions highlighting verified ROI outcomes, health scores, and collaborative future roadmaps": 20,
      "Semi-annual executive presentations reviewing contract utilization metrics": 15,
      "Annual check-in meeting reviewing invoice totals and renewal terms": 10,
      "Only when the contract is 10 days away from expiration": 5
    },
    correctAnswer: "Quarterly sessions highlighting verified ROI outcomes, health scores, and collaborative future roadmaps",
    explanation: "Regular Quarterly Business Reviews (QBRs/EBRs) ensure ongoing value realization and reinforce executive alignment.",
    category: "Guardian",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // =========================================================================
  // 05 Digital - Stage 5 (Shuffled 20, 15, 10, 5 scoring)
  // =========================================================================
  {
    id: 'quest-dig-01',
    text: "Apex Industries needs 2,500 employees to adopt the new self-service digital workplace. Which strategy achieves maximum user engagement?",
    stageDescription: "Digital drives API integration, automated platform adoption, and seamless operational excellence.",
    options: [
      "Deploy interactive contextual in-app guidance, gamified learning paths, and champion recognition programs",
      "Conduct department-level training workshops with recorded replay links",
      "Send recorded webinar links via company-wide email announcement",
      "Mandate all employees read a static 200-page PDF over the weekend"
    ],
    optionScores: {
      "Deploy interactive contextual in-app guidance, gamified learning paths, and champion recognition programs": 20,
      "Conduct department-level training workshops with recorded replay links": 15,
      "Send recorded webinar links via company-wide email announcement": 10,
      "Mandate all employees read a static 200-page PDF over the weekend": 5
    },
    correctAnswer: "Deploy interactive contextual in-app guidance, gamified learning paths, and champion recognition programs",
    explanation: "Modern digital adoption thrives on micro-learning, embedded walkthroughs, and internal peer champions.",
    category: "Digital",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-dig-02',
    text: "What digital metric gives Apex's executive steering committee the clearest view of system health and customer experience?",
    stageDescription: "Digital drives API integration, automated platform adoption, and seamless operational excellence.",
    options: [
      "Weekly portal login counts without tracking feature interactions",
      "Task completion rate, Daily Active Users (DAU/MAU), and Customer Satisfaction Score (CSAT)",
      "Feature adoption percentages and average user session durations",
      "Total megabytes of raw database backup files stored"
    ],
    optionScores: {
      "Task completion rate, Daily Active Users (DAU/MAU), and Customer Satisfaction Score (CSAT)": 20,
      "Feature adoption percentages and average user session durations": 15,
      "Weekly portal login counts without tracking feature interactions": 10,
      "Total megabytes of raw database backup files stored": 5
    },
    correctAnswer: "Task completion rate, Daily Active Users (DAU/MAU), and Customer Satisfaction Score (CSAT)",
    explanation: "Product adoption indices, completion velocity, and satisfaction benchmarks provide true behavioral indicators.",
    category: "Digital",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-dig-03',
    text: "Apex's operations team needs real-time automated data synchronization between the platform and their ERP. What is the digital best practice?",
    stageDescription: "Digital drives API integration, automated platform adoption, and seamless operational excellence.",
    options: [
      "Implement event-driven webhooks and authenticated REST APIs with idempotency and retry queues",
      "Configure automated scheduled API polling every 5 minutes",
      "Schedule scheduled hourly SFTP file uploads between systems",
      "Have a staff member manually export and re-upload CSV spreadsheets twice daily"
    ],
    optionScores: {
      "Implement event-driven webhooks and authenticated REST APIs with idempotency and retry queues": 20,
      "Configure automated scheduled API polling every 5 minutes": 15,
      "Schedule scheduled hourly SFTP file uploads between systems": 10,
      "Have a staff member manually export and re-upload CSV spreadsheets twice daily": 5
    },
    correctAnswer: "Implement event-driven webhooks and authenticated REST APIs with idempotency and retry queues",
    explanation: "Event-driven, idempotent webhook architectures guarantee real-time integrity and fault resilience.",
    category: "Digital",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'quest-dig-04',
    text: "At the 1-year mark, Apex achieves 95% digital adoption and 40% operational cost savings. What is the ultimate partnership milestone?",
    stageDescription: "Digital drives API integration, automated platform adoption, and seamless operational excellence.",
    options: [
      "Offer a multi-year enterprise expansion proposal with dedicated engineering tier",
      "Publish a co-branded global case study and expand the digital transformation partnership into new enterprise units",
      "Offer a standard renewal discount for an additional single year",
      "Cancel their account because they no longer need support"
    ],
    optionScores: {
      "Publish a co-branded global case study and expand the digital transformation partnership into new enterprise units": 20,
      "Offer a multi-year enterprise expansion proposal with dedicated engineering tier": 15,
      "Offer a standard renewal discount for an additional single year": 10,
      "Cancel their account because they no longer need support": 5
    },
    correctAnswer: "Publish a co-branded global case study and expand the digital transformation partnership into new enterprise units",
    explanation: "Turning a happy enterprise client into an industry advocate completes the Customer Journey Quest from first click to lifetime trust!",
    category: "Digital",
    points: 20,
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
