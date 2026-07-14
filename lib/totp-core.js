const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_ALGORITHM = "SHA-1";
const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;
const DEFAULT_OTP_TYPE = "totp";

export function decodeBase32(secret) {
  const normalized = String(secret || "")
    .toUpperCase()
    .replace(/[^A-Z2-7=]/g, "")
    .replace(/=+$/g, "");

  if (!normalized) {
    throw new Error("Informe uma chave Base32.");
  }

  let bits = "";

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);

    if (index < 0) {
      throw new Error("A chave precisa estar em Base32.");
    }

    bits += index.toString(2).padStart(5, "0");
  }

  const bytes = [];

  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }

  return new Uint8Array(bytes);
}

export function encodeBase32(bytes) {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bits = "";

  for (const value of source) {
    bits += value.toString(2).padStart(8, "0");
  }

  let output = "";

  for (let offset = 0; offset < bits.length; offset += 5) {
    const chunk = bits.slice(offset, offset + 5);

    if (!chunk) {
      continue;
    }

    output += BASE32_ALPHABET[Number.parseInt(chunk.padEnd(5, "0"), 2)];
  }

  return output;
}

export function normalizeOtpType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "hotp" ? "hotp" : DEFAULT_OTP_TYPE;
}

export function normalizeAlgorithm(value) {
  const normalized = String(value || "").trim().toUpperCase().replace(/_/g, "-");

  if (normalized === "SHA256" || normalized === "SHA-256") {
    return "SHA-256";
  }

  if (normalized === "SHA512" || normalized === "SHA-512") {
    return "SHA-512";
  }

  return "SHA-1";
}

export function normalizeTokenDraft({
  label = "",
  secret = "",
  otpType = DEFAULT_OTP_TYPE,
  counter = 0,
  digits = DEFAULT_DIGITS,
  period = DEFAULT_PERIOD,
  algorithm = DEFAULT_ALGORITHM
} = {}) {
  const normalizedSecret = String(secret || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();

  decodeBase32(normalizedSecret);

  return {
    label: String(label || "").trim() || "Token manual",
    secret: normalizedSecret,
    otpType: normalizeOtpType(otpType),
    counter: clampInteger(counter, 0, Number.MAX_SAFE_INTEGER, 0),
    digits: clampInteger(digits, 6, 8, DEFAULT_DIGITS),
    period: clampInteger(period, 10, 120, DEFAULT_PERIOD),
    algorithm: normalizeAlgorithm(algorithm)
  };
}

export async function generateOtp(token, options = {}) {
  const normalized = normalizeTokenDraft(token);
  const secretBytes = decodeBase32(normalized.secret);
  const epochMs = Number.isFinite(options.epochMs) ? options.epochMs : Date.now();
  const counterValue = normalized.otpType === "hotp"
    ? clampInteger(options.counter ?? normalized.counter, 0, Number.MAX_SAFE_INTEGER, normalized.counter)
    : Math.floor(epochMs / (normalized.period * 1000));
  const counterBytes = new Uint8Array(8);
  let workingValue = BigInt(counterValue);

  for (let index = 7; index >= 0; index -= 1) {
    counterBytes[index] = Number(workingValue & 0xffn);
    workingValue >>= 8n;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    {
      name: "HMAC",
      hash: normalized.algorithm
    },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, counterBytes));
  const offset = signature[signature.length - 1] & 0x0f;
  const binaryCode =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);
  const modulo = 10 ** normalized.digits;

  return {
    code: String(binaryCode % modulo).padStart(normalized.digits, "0"),
    counter: counterValue,
    otpType: normalized.otpType,
    algorithm: normalized.algorithm,
    digits: normalized.digits,
    period: normalized.period,
    label: normalized.label
  };
}

export async function runRfcSelfTest() {
  const sharedSecret = encodeBase32(new TextEncoder().encode("12345678901234567890"));
  const vectors = [
    { seconds: 59, expected: "94287082" },
    { seconds: 1111111109, expected: "07081804" },
    { seconds: 1111111111, expected: "14050471" },
    { seconds: 1234567890, expected: "89005924" },
    { seconds: 2000000000, expected: "69279037" },
    { seconds: 20000000000, expected: "65353130" }
  ];

  for (const vector of vectors) {
    const result = await generateOtp(
      {
        label: "RFC test",
        secret: sharedSecret,
        otpType: "totp",
        digits: 8,
        period: 30,
        algorithm: "SHA-1"
      },
      {
        epochMs: vector.seconds * 1000
      }
    );

    if (result.code !== vector.expected) {
      return {
        ok: false,
        message: `Falha no vetor ${vector.seconds}. Esperado ${vector.expected}, recebido ${result.code}.`
      };
    }
  }

  return {
    ok: true,
    message: "Motor TOTP validado com SHA-1, 6 digitos e 30 segundos."
  };
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}
