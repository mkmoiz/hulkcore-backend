import dotenv from "dotenv";
dotenv.config();

const endpoint = "https://api.zeptomail.in/v1.1/email";
const apiKey = process.env.ZEPTOMAIL_SEND_MAIL_TOKEN;
const fromAddress = process.env.ZEPTOMAIL_FROM_ADDRESS;

async function test() {
  const authHeader = apiKey.startsWith("Zoho-enczapikey") ? apiKey : `Zoho-enczapikey ${apiKey}`;
  console.log("Sending with fromAddress:", fromAddress);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      from: {
        address: fromAddress,
        name: "Hulk Core",
      },
      to: [
        {
          email_address: {
            address: "info@moizkhan.dev",
          },
        },
      ],
      subject: "Test API Email",
      htmlbody: "<div>Test email sent successfully.</div>",
    }),
  });

  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Text response:", text);
}

test();
