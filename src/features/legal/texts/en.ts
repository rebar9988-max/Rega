// Review by a German lawyer before relying on this text.
// Translation of the German original; only the German version is legally binding.
import type { LegalBuilder } from "../types";

export const en: LegalBuilder = (o, ctx) => {
  const who = [o.operatorType, o.legalName].filter(Boolean).join(": ");
  const address = `${o.streetAddress}, ${o.postalCodeCity}, ${o.country}`;
  return {
    ui: {
      translationNote: "This page is a translation provided for your convenience. Only the German version is legally binding.",
      germanLink: "Go to the German version",
      updated: "Last updated",
    },

    impressum: {
      title: "Impressum (legal notice)",
      description: "Legal notice of REGA Platform under § 5 DDG: provider, postal address, contact and the person responsible for the content of this free Kurdish portal.",
      blocks: [
        { h: "Information pursuant to § 5 DDG", p: [who, o.responsiblePerson ? `Authorised representative / responsible person: ${o.responsiblePerson}` : "", address].filter(Boolean) },
        { h: "Contact", p: [`Phone: ${o.phone}`, `Email: ${o.publicEmail}`] },
        ...(o.vatId || o.tradeRegister
          ? [{ h: "Register and tax", p: [o.tradeRegister ? `Commercial register: ${o.tradeRegister}` : "", o.vatId ? `VAT identification number (§ 27a UStG): ${o.vatId}` : ""].filter(Boolean) }]
          : []),
        { h: "Responsible for content (§ 18 (2) MStV)", p: [`${o.responsiblePerson || o.legalName}, ${address}`] },
        { h: "Point of contact under the Digital Services Act (Art. 11, 12 DSA)", p: [`Authorities, the Commission and users can reach us electronically at ${o.publicEmail}. We communicate in German and English.`, "You can report illegal content with the form under “Report content”."] },
        { h: "Free of charge", p: ["REGA Platform is free of charge. No fees arise for users or for businesses."] },
        { h: "Consumer dispute resolution", p: ["We are neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board."] },
        { h: "Liability for content", p: ["Entries for businesses, services and locations are created by their owners or by us on the basis of their information. As a service provider we are responsible for our own content under the general laws. For third-party content we are responsible only from the moment we learn of a specific infringement; when we do, we remove such content promptly.", "Statements in AI-generated answers of the REGA Assistant may be wrong and are not a substitute for advice."] },
        { h: "Liability for links", p: ["Our service contains links to external third-party websites whose content we cannot influence. We accept no liability for such content; the respective provider is always responsible. We remove such links promptly when we learn of infringements."] },
        { h: "Copyright", p: ["Content and works created by us are subject to German copyright law. Third-party contributions are marked as such. Reproduction, editing and distribution beyond the limits of copyright law require the consent of the respective rights holder."] },
      ],
    },

    privacy: {
      title: "Privacy policy",
      description: "Privacy policy of REGA Platform: controller, hosting, account, contact form, AI assistant, cookies, your GDPR rights and the right to lodge a complaint.",
      blocks: [
        { h: "1. Controller", p: ["The controller for data processing on this website within the meaning of the General Data Protection Regulation (GDPR) is:", `${who}, ${address}`, `Email: ${o.publicEmail} · Phone: ${o.phone}`] },
        { h: "2. Overview", p: ["REGA Platform is a free directory for the Kurdish community in Germany and Europe. We process personal data only as far as necessary to run the website, your user account, to communicate with you and to protect the service. We do not sell data and do not run advertising or tracking networks."] },
        { h: "3. Hosting and server log files", p: [`The website is operated by ${o.hostingProvider}. When you open it, the hosting provider processes technically necessary data, in particular IP address, date and time, page requested, browser type and operating system, to deliver the site, keep it stable and fend off attacks.`, "Legal basis: Art. 6(1)(f) GDPR (legitimate interest in secure and stable operation). Data may be transferred to third countries on the basis of appropriate safeguards (EU standard contractual clauses or the EU-US Data Privacy Framework). A data processing agreement is in place."] },
        { h: "4. Cookies and local storage", p: ["We use only technically necessary storage that is required for the service you request (§ 25(2) no. 2 TDDDG). For that reason we show no cookie banner."], ul: ["Session cookie (Auth.js): only after sign-in, keeps your session (up to 14 days).", "Language cookie (REGA_LOCALE / NEXT_LOCALE): remembers your language (1 year).", "Browser storage “rega-theme” (localStorage): remembers light/dark mode.", "Browser session storage: a random identifier for the running REGA Assistant chat; it is deleted when you close the tab."] },
        { h: "5. Reach measurement and analytics", p: [ctx.analytics ? `We use the following analytics tool: ${o.analyticsTool}. Where it uses non-essential cookies or similar technologies, we obtain your consent beforehand (§ 25(1) TDDDG, Art. 6(1)(a) GDPR).` : "We use no analytics or tracking tools and show no advertising."] },
        { h: "6. User account and registration", p: ["You can create an account to list businesses and use signed-in features. We process your name, email address, a securely stored password (hash, never plain text), account type (user or business), language, the time you accepted the Terms and this Privacy policy, and the time of email confirmation and last sign-in.", `To send confirmation and password-reset emails we use an email service provider${o.emailProvider ? ` (${o.emailProvider})` : ""} as processor.`, "Legal basis: Art. 6(1)(b) GDPR (contract of use) and (f) (security, abuse prevention). We keep the data until you have your account deleted."] },
        { h: "7. Contact form and email", p: ["If you use the contact form we store your name, optionally your email address, subject, message and the language of your page, and forward the message to our team by email. The data is used only to handle your request (Art. 6(1)(b) or (f) GDPR) and deleted once it is no longer needed, at the latest after statutory retention periods. To protect against spam, the number of submissions per connection is limited."] },
        { h: "8. Reporting content (Digital Services Act)", p: ["With the report form we collect the reported address, the reason, your explanation and your name and email address in order to assess the notice and tell you the outcome (Art. 6(1)(c) GDPR in conjunction with Art. 16 DSA). The data is kept as long as needed to handle the notice and document the decision."] },
        { h: "9. Business listings", p: ["Business listings (name, description, address, phone, email, website, opening hours, images, map position) are shown publicly. They are submitted by the owners themselves or at their request; they are responsible for being allowed to publish this information. Images are stored in an object storage. Legal basis: Art. 6(1)(b) and (f) GDPR.", "Reviews: if you write a review, we publish the name stored in your account, your rating, your comment and the date once a moderator has approved it. Each user can write one review per business; you can edit it or have it deleted by writing to us. Legal basis: Art. 6(1)(b) and (f) GDPR.", "Jobs, events and guides: these entries are published by businesses or by our team. Contact details a business gives for applications (email address or link) are shown publicly with the entry. Legal basis: Art. 6(1)(b) and (f) GDPR."] },
        { h: "10. REGA Assistant (AI)", p: [`When you use the REGA Assistant, your question, the conversation so far and matching public listings from our directory are sent to our AI provider: ${o.aiProvider}. The provider processes the data as processor and may be located in third countries (safeguards: standard contractual clauses).`, "Please do not enter sensitive personal data into the chat. Answers are generated by AI and may be wrong.", `We store the chat under a random session identifier (without name or email; for signed-in users linked to the account) for at most ${ctx.aiRetentionDays} days and then delete it automatically. Legal basis: Art. 6(1)(b) and (f) GDPR.`] },
        { h: "11. Location (“Nearby”) and maps", p: ["The nearby search uses your location only if you agree to your browser’s prompt (Art. 6(1)(a) GDPR). The coordinates are sent to our server for the search and are not stored. You can choose a city instead.", "Map tiles are loaded directly from a map service (default: OpenFreeMap, tiles.openfreemap.org, based on OpenStreetMap data). Your IP address is transmitted to the map service (Art. 6(1)(f) GDPR, interest in displaying a map)."] },
        { h: "12. Recipients", p: ["Recipients are our processors (hosting, email delivery, AI service, object storage) and, where legally required, authorities. Data is not passed on for advertising."] },
        { h: "13. Your rights", p: ["You have the right to access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18), data portability (Art. 20) and to object to processing based on legitimate interests (Art. 21 GDPR). You can withdraw consent at any time with effect for the future. Contact us at " + o.publicEmail + "."] },
        { h: "14. Right to lodge a complaint", p: ["You have the right to lodge a complaint with a data protection supervisory authority, in particular in the Member State of your residence or of the alleged infringement. A list of the German authorities is available at https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html."] },
        { h: "15. Provision of data and automated decisions", p: ["The public pages can be used without giving personal data. An account requires name, email address and password. No exclusively automated decision-making, including profiling, takes place."] },
        { h: "16. Changes", p: ["We update this policy when features or the legal situation change. The version published here applies."] },
      ],
    },

    terms: {
      title: "Terms of use",
      description: "Terms of use of REGA Platform: free use without fees, rules for listings, moderation, liability and deletion of your account.",
      blocks: [
        { h: "1. Scope", p: [`These terms apply to the use of REGA Platform (www.regaplatform.com), operated by ${who}, ${address}.`] },
        { h: "2. Free of charge", p: ["REGA Platform is completely free for users and for businesses. There are no fees, subscriptions, paid placements or payment features."] },
        { h: "3. Account", p: ["An account is required to list a business. You must give truthful information, keep your credentials secret and tell us promptly about any misuse of your account. One account per person is intended."] },
        { h: "4. Rules for listings and contributions", p: ["You may only post content you are entitled to publish. In particular the following is not allowed:"], ul: ["unlawful, insulting, discriminatory or hateful content;", "false or misleading information, invented businesses or reviews;", "spam, advertising for unrelated offers and duplicate listings of the same service;", "content that infringes third-party rights (copyright, trademark, personality rights);", "information about third parties without their consent;", "reviews that do not reflect your own experience, reviews of your own business, and bought or traded reviews."] },
        { h: "5. Review and “Rega Verified”", p: ["New listings are reviewed by us before publication and may be rejected or sent back for changes. The “Rega Verified” label means that we have checked certain information of the listing. It is not a recommendation and not a guarantee of the quality of the offer.", "Reviews and entries for jobs, events and guides are also published only after review. We may reject or remove contributions that break these rules."] },
        { h: "6. Grant of rights", p: ["You grant us the simple, non-exclusive right to display your listings and images on REGA Platform in all language versions and to reproduce them technically for that purpose. The rights remain with you."] },
        { h: "7. Reporting and removal", p: ["Unlawful or rule-breaking content can be reported via “Report content”. We may remove content and block accounts if laws or these terms are violated; we inform those affected and state the reason where the law provides."] },
        { h: "8. Liability", p: ["We are fully liable for intent and gross negligence, for injury to life, body and health and under the Product Liability Act. For slight negligence we are liable only for breach of essential contractual obligations and limited to foreseeable, typical damage. We give no warranty for information in listings, for third-party offers or for the accuracy of AI-generated answers. We do not owe permanent availability."] },
        { h: "9. Deleting your account", p: [`You can have your account deleted at any time by writing to us at ${o.publicEmail}. We delete your account data; listings are removed or anonymised unless statutory retention duties apply.`] },
        { h: "10. Changes, applicable law", p: ["We may change these terms with effect for the future; we announce material changes. German law applies; mandatory consumer protection rules of the state where you habitually reside remain unaffected. If a provision is invalid, the rest remains valid."] },
      ],
    },
  };
};
