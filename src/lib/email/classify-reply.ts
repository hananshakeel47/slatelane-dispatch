export type ReplyClassification =
  | "interested"
  | "need_rates"
  | "call_me"
  | "not_interested"
  | "wrong_contact"
  | "unsubscribe"
  | "other";


export type ReplyClassificationResult = {
  classification: ReplyClassification;
  confidence: number;
  reason: string;
  requiresAttention: boolean;
  cleanedText: string;
  leadStatus: string | null;
};


export function cleanReplyText(
  input: string | null | undefined
) {
  if (!input) {
    return "";
  }

  let text = input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();


  /*
   * Gmail frequently returns:
   *
   * Yes send me information
   * On Sat, 22 Aug ... wrote:
   * > previous email
   *
   * Sometimes everything is on one line.
   */
  const inlineReplyMarker =
    text.search(
      /\sOn\s.{1,500}?\bwrote:\s*/i
    );

  if (inlineReplyMarker >= 0) {
    text = text
      .slice(0, inlineReplyMarker)
      .trim();
  }


  const markers = [
    /^On .+ wrote:$/i,
    /^On .+wrote:$/i,

    /^-{2,}\s*Original Message\s*-{2,}$/i,

    /^-{2,}\s*Forwarded message\s*-{2,}$/i,

    /^From:\s.+@.+$/i,

    /^Sent:\s.+$/i,
  ];


  const lines =
    text.split("\n");

  const cleanedLines: string[] =
    [];


  for (const line of lines) {
    const trimmed =
      line.trim();


    const isMarker =
      markers.some(
        (pattern) =>
          pattern.test(trimmed)
      );


    if (
      isMarker &&
      cleanedLines.length > 0
    ) {
      break;
    }


    /*
     * Remove normal quoted email lines.
     */
    if (
      trimmed.startsWith(">")
    ) {
      continue;
    }


    cleanedLines.push(line);
  }


  return cleanedLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


function containsAny(
  text: string,
  phrases: string[]
) {
  return phrases.some(
    (phrase) =>
      text.includes(phrase)
  );
}


export function classifyReply(
  text:
    string | null | undefined,

  subject:
    string | null | undefined = null
): ReplyClassificationResult {

  const cleanedText =
    cleanReplyText(text);


  const normalized =
    `${subject ?? ""} ${cleanedText}`
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(
        /[^a-z0-9@%$+\-.\s']/g,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();


  // ==========================================================
  // 1. UNSUBSCRIBE
  // Highest priority because this is a compliance action.
  // ==========================================================

  if (
    containsAny(
      normalized,
      [
        "unsubscribe",
        "remove me",
        "remove my email",
        "remove my address",
        "take me off",
        "take me off your list",
        "stop emailing",
        "stop email",
        "stop sending",
        "do not email",
        "don't email",
        "dont email",
        "no more emails",
        "no more email",
        "opt me out",
        "opt out",
        "delete my email",
      ]
    )
  ) {
    return {
      classification:
        "unsubscribe",

      confidence:
        0.99,

      reason:
        "Reply contains an explicit request to stop receiving email.",

      requiresAttention:
        false,

      cleanedText,

      leadStatus:
        "not_interested",
    };
  }


  // ==========================================================
  // 2. WRONG CONTACT
  // ==========================================================

  if (
    containsAny(
      normalized,
      [
        "wrong person",
        "wrong contact",
        "wrong email",
        "you have the wrong",
        "not the right person",
        "not the correct person",
        "no longer work",
        "doesn't work here",
        "does not work here",
        "left the company",
        "no longer with",
        "contact someone else",
      ]
    )
  ) {
    return {
      classification:
        "wrong_contact",

      confidence:
        0.96,

      reason:
        "Reply indicates SlateLane contacted the wrong person or outdated contact.",

      requiresAttention:
        true,

      cleanedText,

      leadStatus:
        "not_interested",
    };
  }


  // ==========================================================
  // 3. NOT INTERESTED
  // Must be checked before positive word "interested".
  // ==========================================================

  if (
    containsAny(
      normalized,
      [
        "not interested",
        "no thanks",
        "no thank you",
        "not needed",
        "don't need",
        "dont need",
        "do not need",
        "we don't need",
        "we dont need",
        "we do not need",
        "already have a dispatcher",
        "already have dispatcher",
        "already have dispatch",
        "already using a dispatcher",
        "we are good",
        "we're good",
        "were good",
        "not looking",
        "not currently looking",
        "not at this time",
        "maybe later",
        "no need",
      ]
    )
  ) {
    return {
      classification:
        "not_interested",

      confidence:
        0.96,

      reason:
        "Reply clearly declines SlateLane's service or indicates no current need.",

      requiresAttention:
        false,

      cleanedText,

      leadStatus:
        "not_interested",
    };
  }


  // ==========================================================
  // 4. CALL ME
  // ==========================================================

  if (
    containsAny(
      normalized,
      [
        "call me",
        "give me a call",
        "give us a call",
        "call us",
        "phone me",
        "phone us",
        "please call",
        "can you call",
        "could you call",
        "call tomorrow",
        "call today",
        "call later",
        "reach me at",
        "contact me by phone",
      ]
    )
  ) {
    return {
      classification:
        "call_me",

      confidence:
        0.96,

      reason:
        "Reply explicitly asks SlateLane to contact the lead by phone.",

      requiresAttention:
        true,

      cleanedText,

      leadStatus:
        "follow_up",
    };
  }


  // ==========================================================
  // 5. NEED RATES / PRICING
  // Checked before generic interest.
  // ==========================================================

  if (
    containsAny(
      normalized,
      [
        "send rates",
        "your rates",
        "what are your rates",
        "what are the rates",
        "rate sheet",
        "pricing",
        "your pricing",
        "price",
        "prices",
        "how much",
        "what do you charge",
        "what do you guys charge",
        "what does it cost",
        "cost",
        "fee",
        "fees",
        "commission",
        "percentage",
        "percent do you charge",
        "dispatch fee",
        "dispatch fees",
      ]
    )
  ) {
    return {
      classification:
        "need_rates",

      confidence:
        0.95,

      reason:
        "Reply asks about SlateLane pricing, rates, fees, or commission.",

      requiresAttention:
        true,

      cleanedText,

      leadStatus:
        "interested",
    };
  }


  // ==========================================================
  // 6. INTERESTED
  // ==========================================================

  if (
    containsAny(
      normalized,
      [
        "i am interested",
        "i'm interested",
        "im interested",
        "we are interested",
        "we're interested",
        "interested in",
        "send me information",
        "send information",
        "send me info",
        "send info",
        "more information",
        "more info",
        "give me more info",
        "tell me more",
        "send details",
        "send me details",
        "yes please",
        "yes send",
        "sounds good",
        "sounds interesting",
        "let's talk",
        "lets talk",
        "let's discuss",
        "lets discuss",
        "how does it work",
        "how do you work",
        "what services",
      ]
    )
  ) {
    return {
      classification:
        "interested",

      confidence:
        0.93,

      reason:
        "Reply shows positive interest or requests more information.",

      requiresAttention:
        true,

      cleanedText,

      leadStatus:
        "interested",
    };
  }


  // ==========================================================
  // 7. OTHER
  // ==========================================================

  return {
    classification:
      "other",

    confidence:
      0.45,

    reason:
      "No strong intent pattern was detected. Manual review is recommended.",

    requiresAttention:
      true,

    cleanedText,

    leadStatus:
      null,
  };
}