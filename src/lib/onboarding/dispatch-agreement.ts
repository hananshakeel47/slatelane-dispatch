export const DISPATCH_AGREEMENT_VERSION = "2026-09-14-v1";

export type DispatchFeeType =
  | "percentage"
  | "flat_per_load"
  | "weekly_flat";

export type DispatchAgreementFormData = {
  company_name: string;
  dot_number: string;
  mc_number: string;

  signer_name: string;
  signer_title: string;
  signer_email: string;
  electronic_signature: string;

  dispatch_fee_type: DispatchFeeType;
  dispatch_fee_value: string;

  minimum_rate_per_mile: string;

  factoring_company: string;
  insurance_company: string;
  insurance_expiration: string;

  preferred_lanes: string;
  preferred_states: string;
  regions_to_avoid: string;

  home_time_notes: string;
  operating_notes: string;

  consent: boolean;
};

export const DISPATCH_AGREEMENT_SECTIONS = [
  {
    title: "1. Parties and Purpose",
    paragraphs: [
      "This Carrier-Dispatcher Agreement is entered into between Slate Lane Dispatch, referred to as the Dispatcher, and the motor carrier identified in this agreement, referred to as the Carrier.",
      "The Carrier appoints the Dispatcher to provide administrative dispatch support for the Carrier's transportation operations, subject to the terms of this agreement.",
    ],
  },
  {
    title: "2. Independent Contractor Relationship",
    paragraphs: [
      "The Dispatcher and Carrier are independent contracting parties. Nothing in this agreement creates an employer-employee relationship, partnership, joint venture, or ownership interest between the parties.",
      "The Carrier remains independently responsible for its drivers, vehicles, operating authority, taxes, permits, safety compliance, insurance, cargo, and transportation operations.",
    ],
  },
  {
    title: "3. Dispatch Services",
    paragraphs: [
      "At the Carrier's direction, the Dispatcher may search for freight opportunities, communicate with brokers and shippers, obtain load information, assist with rate negotiations, organize load documents, communicate pickup and delivery information, assist with check calls, maintain operational records, and provide related administrative dispatch support.",
      "The Carrier retains final authority to accept or reject every load. The Dispatcher will not intentionally bind the Carrier to a load without authorization from the Carrier or an authorized representative.",
    ],
  },
  {
    title: "4. Carrier Authority and Compliance",
    paragraphs: [
      "The Carrier represents that it holds all operating authority, registrations, permits, licenses, insurance, and qualifications required for the transportation services it performs.",
      "The Carrier is solely responsible for compliance with applicable FMCSA, DOT, state, local, safety, hours-of-service, vehicle maintenance, cargo securement, driver qualification, and other transportation requirements.",
      "The Carrier must immediately notify the Dispatcher of any suspension, revocation, expiration, material insurance change, safety restriction, or other event that may affect the Carrier's ability to legally transport freight.",
    ],
  },
  {
    title: "5. Dispatcher Role",
    paragraphs: [
      "The Dispatcher acts as an administrative dispatch representative for the Carrier and does not take possession of freight or operate the Carrier's equipment.",
      "The parties intend the Dispatcher to perform services on behalf of the Carrier rather than operate as the Carrier itself. Nothing in this agreement authorizes either party to perform activities prohibited by applicable law.",
    ],
  },
  {
    title: "6. Load Selection and Rate Negotiation",
    paragraphs: [
      "The Dispatcher may negotiate freight rates and operating terms using preferences supplied by the Carrier. The Carrier may establish minimum rate requirements, preferred lanes, excluded areas, equipment restrictions, home-time requirements, and other operating preferences.",
      "Market conditions vary and no particular freight rate, revenue level, mileage, load frequency, or weekly income is guaranteed.",
    ],
  },
  {
    title: "7. Dispatch Fees",
    paragraphs: [
      "The Carrier agrees to pay the dispatch fee identified in the Commercial Terms section of the completed agreement.",
      "Any change to the dispatch fee must be agreed to by both parties. Outstanding undisputed dispatch fees remain payable after termination of this agreement.",
      "Failure to pay undisputed amounts may result in suspension or termination of dispatch services.",
    ],
  },
  {
    title: "8. Broker and Shipper Payments",
    paragraphs: [
      "Freight charges are payable to the Carrier or its authorized factoring company and not to the Dispatcher unless the parties establish a separate lawful written payment arrangement.",
      "The Carrier remains responsible for reviewing rate confirmations, broker-carrier agreements, factoring requirements, quick-pay arrangements, deductions, claims, and settlement documents.",
    ],
  },
  {
    title: "9. Factoring and Documentation",
    paragraphs: [
      "The Carrier authorizes the Dispatcher to communicate with the Carrier's factoring company, insurance representatives, brokers, and other business contacts when reasonably necessary to provide dispatch services.",
      "The Carrier is responsible for providing accurate W-9 information, authority documentation, certificate of insurance, factoring notice of assignment when applicable, and other documents reasonably required for broker setup or onboarding.",
    ],
  },
  {
    title: "10. Insurance and Claims",
    paragraphs: [
      "The Carrier is solely responsible for maintaining legally required insurance coverage and any additional coverage required by brokers or shippers.",
      "Cargo claims, property damage, bodily injury, accidents, freight loss, freight damage, citations, towing, breakdowns, and other transportation liabilities arising from operation of the Carrier's equipment remain the responsibility of the Carrier except to the extent caused by the Dispatcher's own unlawful or intentionally wrongful conduct.",
    ],
  },
  {
    title: "11. Accuracy of Information",
    paragraphs: [
      "The Carrier represents that information and documents supplied to the Dispatcher are accurate and current.",
      "The Dispatcher may rely on information supplied by the Carrier when communicating with brokers and other third parties.",
    ],
  },
  {
    title: "12. Confidentiality",
    paragraphs: [
      "Each party will use reasonable care to protect non-public business information received from the other party, including pricing information, customer information, credentials, financial information, business records, and operating strategies.",
      "Confidential information may be disclosed when required by law or when reasonably necessary to perform authorized dispatch and transportation activities.",
    ],
  },
  {
    title: "13. No Revenue Guarantee",
    paragraphs: [
      "The Dispatcher does not guarantee any specific load, rate per mile, gross revenue, profit, number of miles, broker relationship, lane availability, or business result.",
      "Actual results depend on freight markets, equipment, location, seasonality, broker requirements, driver availability, operating costs, economic conditions, and other factors outside the Dispatcher's control.",
    ],
  },
  {
    title: "14. Term and Termination",
    paragraphs: [
      "This agreement begins when electronically accepted by the Carrier and continues until terminated by either party.",
      "Either party may terminate the dispatch relationship by providing written notice. Termination does not eliminate obligations that arose before termination, including payment of earned dispatch fees and protection of confidential information.",
    ],
  },
  {
    title: "15. Electronic Records and Signatures",
    paragraphs: [
      "The parties agree that electronic records and electronic signatures may be used in connection with this agreement.",
      "Typing the authorized signer's name, affirmatively accepting the agreement, and submitting the secure Slate Lane onboarding form constitutes the Carrier's electronic signature and intent to enter into this agreement.",
    ],
  },
  {
    title: "16. Entire Agreement",
    paragraphs: [
      "This agreement, together with any incorporated commercial terms and written amendments accepted by both parties, represents the parties' understanding concerning the dispatch services described here.",
      "If any provision is determined to be unenforceable, the remaining provisions will continue to the extent permitted by law.",
    ],
  },
] as const;

export function formatDispatchFee(
  type: DispatchFeeType,
  rawValue: string | number,
) {
  const value =
    typeof rawValue === "number"
      ? rawValue
      : Number.parseFloat(String(rawValue || "0"));

  if (type === "percentage") {
    return `${value}% of gross load revenue`;
  }

  if (type === "flat_per_load") {
    return `$${value.toFixed(2)} per load`;
  }

  return `$${value.toFixed(2)} per week`;
}