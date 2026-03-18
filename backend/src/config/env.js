import dotenv from "dotenv";
dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  frontendOrigin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
  openAIApiKey: process.env.OPENAI_API_KEY || "",
  openAIModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  clinic: {
    name:    process.env.CLINIC_NAME    || "Kyron Medical",
    hours:   process.env.CLINIC_HOURS   || "Monday – Friday, 8:00 AM – 6:00 PM",
    phone:   process.env.CLINIC_PHONE   || "+1 (555) 596-7661",
    email:   process.env.CLINIC_EMAIL   || "care@kyronmedical.com",
    address: process.env.CLINIC_ADDRESS || "1 Medical Plaza, Suite 400, San Francisco, CA 94105"
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || `Kyron Medical <${process.env.SMTP_USER || "care@kyronmedical.com"}>`
  },
  twilio: {
    sid: process.env.TWILIO_ACCOUNT_SID || "",
    token: process.env.TWILIO_AUTH_TOKEN || "",
    from: process.env.TWILIO_PHONE_NUMBER || "",
enableSms: String(process.env.ENABLE_SMS).toLowerCase() === "true"
  },
  vapi: {
    apiKey: process.env.VAPI_API_KEY || "",
    assistantId: process.env.VAPI_ASSISTANT_ID || "",
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID || "",
    enabled: String(process.env.ENABLE_VOICE).toLowerCase() === "true",
    publicAppUrl: process.env.PUBLIC_APP_URL || "http://localhost:4000"
  }
};
