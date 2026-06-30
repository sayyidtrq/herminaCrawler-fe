export const issueLabels: Record<string, string> = {
  doctor_service: "Layanan Dokter",
  nurse_service: "Layanan Perawat",
  administration: "Administrasi",
  waiting_time: "Waktu Tunggu",
  cleanliness: "Kebersihan",
  facility: "Fasilitas",
  parking: "Parkir",
  billing: "Billing",
  pharmacy: "Farmasi",
  emergency_room: "IGD",
  inpatient: "Rawat Inap",
  customer_service: "Customer Service",
  booking_system: "Sistem Booking",
  staff_communication: "Komunikasi Staff",
  security: "Keamanan",
  food: "Makanan",
  general_praise: "Pujian Umum",
  other: "Lainnya",
};

export function sentimentLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    positive: "Positif",
    neutral: "Netral",
    negative: "Negatif",
    mixed: "Campuran",
    unknown: "Unknown",
  };
  return labels[value ?? "unknown"] ?? value ?? "Unknown";
}

export function urgencyLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
    unknown: "Unknown",
  };
  return labels[value ?? "unknown"] ?? value ?? "Unknown";
}

export function issueLabel(value: string | null | undefined) {
  if (!value) return "Belum dianalisis";
  return issueLabels[value] ?? value;
}

export function toneForSentiment(value: string | null | undefined) {
  if (value === "positive") return "positive";
  if (value === "negative") return "danger";
  if (value === "mixed") return "warning";
  if (value === "neutral") return "info";
  return "neutral";
}

export function toneForUrgency(value: string | null | undefined) {
  if (value === "critical") return "critical";
  if (value === "high") return "danger";
  if (value === "medium") return "warning";
  if (value === "low") return "positive";
  return "neutral";
}
