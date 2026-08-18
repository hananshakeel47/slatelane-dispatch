type LeadData = {
  name:
    string | null;

  company_name:
    string | null;

  email:
    string | null;

  carrier_dot_number:
    number | null;

  mc_number:
    string | null;
};


type TemplateData = {
  subject: string;

  html_body: string;

  text_body:
    string | null;
};


type RenderConfig = {
  senderName: string;

  businessAddress:
    string;
};


function escapeHtml(
  value: string
) {
  return value
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


function replaceTokens(
  input: string,
  values:
    Record<
      string,
      string
    >,
  html: boolean
) {
  return input.replace(
    /\{\{([a-z_]+)\}\}/gi,

    (
      _match,
      token:
        string
    ) => {
      const value =
        values[
          token.toLowerCase()
        ] ?? "";

      return html
        ? escapeHtml(value)
        : value;
    }
  );
}


export function renderEmailTemplate(
  template:
    TemplateData,

  lead:
    LeadData,

  unsubscribeUrl:
    string,

  config:
    RenderConfig
) {
  const contactName =
    lead.name &&
    lead.name !==
      lead.company_name
      ? lead.name
      : "";


  const values = {
    contact_name:
      contactName,

    company_name:
      lead.company_name ||
      lead.name ||
      "your company",

    email:
      lead.email ||
      "",

    dot_number:
      lead
        .carrier_dot_number
        ?.toString() ||
      "",

    mc_number:
      lead.mc_number ||
      "",

    unsubscribe_url:
      unsubscribeUrl,

    business_address:
      config
        .businessAddress,

    sender_name:
      config.senderName,
  };


  const subject =
    replaceTokens(
      template.subject,
      values,
      false
    )
      .replace(
        /[\r\n]+/g,
        " "
      )
      .trim();


  const bodyHtml =
    replaceTokens(
      template.html_body,
      values,
      true
    );


  const bodyText =
    replaceTokens(
      template.text_body ||
        "",
      values,
      false
    );


  /*
   * Compliance footer is appended
   * automatically to every outreach
   * message.
   */

  const footerHtml = `
<hr
  style="
    margin:32px 0 20px;
    border:0;
    border-top:1px solid #dddddd;
  "
/>

<p
  style="
    font-size:12px;
    line-height:18px;
    color:#666666;
  "
>
  Business outreach / advertisement from
  ${escapeHtml(
    config.senderName
  )}.<br>

  ${escapeHtml(
    config.businessAddress
  )}<br><br>

  Don't want to receive future outreach?
  <a
    href="${escapeHtml(
      unsubscribeUrl
    )}"
  >
    Unsubscribe
  </a>.
</p>
`;


  const footerText = `

---

Business outreach / advertisement from ${config.senderName}.
${config.businessAddress}

To stop future outreach:
${unsubscribeUrl}
`;


  return {
    subject,

    html:
      `${bodyHtml}${footerHtml}`,

    text:
      `${bodyText}${footerText}`,
  };
}