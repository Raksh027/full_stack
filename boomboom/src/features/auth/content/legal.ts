export type LegalSectionId = 'terms' | 'privacy' | 'safety' | 'community';

export type LegalSection = {
  id: LegalSectionId;
  tabLabel: string;
  title: string;
  body: string;
};

export const LEGAL_SECTIONS: readonly LegalSection[] = [
  {
    id: 'terms',
    tabLabel: 'TERMS',
    title: 'TERMS & CONDITIONS',
    body: `Effective Date: 10/11/2025
Last Updated: 10/11/2025

Application Name: Boom Boom
Company/Developer: Shivacha Technologies Private Limited

By using BoomBoom, you agree to:

• You have read and understood these Terms
• You are at least 18 years old
• You voluntarily enter into a contract with us

ELIGIBILITY:
• You must be 18+ years old
• Legally capable of entering into binding contracts
• Not prohibited by law from using dating services

USER BEHAVIOR & SAFETY:
• Zero tolerance for harassment, threats, or abuse
• No financial requests or scams
• No explicit or illegal content
• Violation = Immediate permanent account termination

NO LIABILITY CLAUSE:
BoomBoom only provides a platform for individuals to connect. The Company:
• Does NOT verify user identity or conduct background checks
• Is NOT responsible for user-generated content
• Does NOT take responsibility for what happens during chats or offline meetings

YOU AGREE THAT:
• You are solely responsible for interactions with other users
• You meet people at your own risk
• The Company shall have no liability whatsoever for scams, fraud, financial loss, harassment, mental distress, physical harm, or death`,
  },
  {
    id: 'privacy',
    tabLabel: 'PRIVACY',
    title: 'PRIVACY POLICY',
    body: `Effective Date: 10/11/2025
Last Updated: 10/11/2025

INFORMATION WE COLLECT:
• Personal identifiers (Name, phone, email, gender, DOB)
• Profile photos, bio, chat messages
• Location data, device information

PURPOSE OF DATA COLLECTION:
• Create & manage user profiles
• Show relevant matches
• Prevent fraud and abuse
• Improve app performance

We DO NOT:
• Sell user data
• Share data for marketing without consent

SECURITY:
We use encryption and secure servers, but no app can guarantee 100% security.`,
  },
  {
    id: 'safety',
    tabLabel: 'USER',
    title: 'USER SAFETY GUIDELINES',
    body: `⚠️ IMPORTANT:
BoomBoom is ONLY a platform. Users are solely responsible for their interactions.

SAFETY PRINCIPLES:
• Always trust your instincts
• You are in control of conversations
• Take time to know someone

PROTECT YOUR INFORMATION:
• Never share home address or workplace
• Never share financial details
• Never share OTPs, passwords, or personal documents

RED FLAGS - BLOCK IMMEDIATELY:
• Asking for money or gifts
• Emotional manipulation
• Rushing to meet privately
• Refusing video calls

OFFLINE MEETING SAFETY:
• Meet in public places
• Inform friends or family
• Arrange your own transportation
• Do not go to isolated places`,
  },
  {
    id: 'community',
    tabLabel: 'COMMUNITY',
    title: 'COMMUNITY GUIDELINES',
    body: `BE RESPECTFUL:
• No harassment, bullying, or threats
• No discrimination of any kind

CONSENT IS MANDATORY:
• Never pressure for photos or meetings
• No means NO - stop immediately

REAL PEOPLE, REAL INTENTIONS:
• No fake profiles or impersonation
• No AI-generated profiles

PROHIBITED CONTENT:
• Sexual or explicit content
• Violent or abusive content
• Illegal activity
• Financial solicitation
• Child exploitation

VIOLATION = Immediate permanent ban`,
  },
];
