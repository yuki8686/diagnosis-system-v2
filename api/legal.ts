import { json, methodNotAllowed, type ApiRequest, type ApiResponse } from "./_lib/http";
import { legalConfigurationComplete } from "./_lib/env";

const fields = ["LEGAL_SELLER_NAME", "LEGAL_RESPONSIBLE_PERSON", "LEGAL_ADDRESS", "LEGAL_PHONE", "LEGAL_CONTACT_EMAIL", "LEGAL_SUPPORT_HOURS"] as const;

export default function handler(request: ApiRequest, response: ApiResponse): void {
  if (request.method !== "GET") return methodNotAllowed(response);
  if (!legalConfigurationComplete()) return json(response, 200, { configured: false });
  return json(response, 200, {
    configured: true,
    sellerName: process.env[fields[0]],
    responsiblePerson: process.env[fields[1]],
    address: process.env[fields[2]],
    phone: process.env[fields[3]],
    contactEmail: process.env[fields[4]],
    supportHours: process.env[fields[5]],
    serviceName: process.env.SERVICE_NAME,
    diagnosisName: process.env.DIAGNOSIS_NAME,
    productName: process.env.PAID_PRODUCT_NAME,
  });
}
