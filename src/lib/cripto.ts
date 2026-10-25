// Criptografia dos segredos de integração (tokens da Meta, hottok, token da Kiwify) no banco.
// AES-256-GCM com a chave de ENCRYPTION_KEY (64 caracteres hex). Valores antigos sem o prefixo
// continuam sendo lidos como texto puro.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIXO = "enc:v1:";

function chave(): Buffer | null {
  const k = process.env.ENCRYPTION_KEY;
  if (!k) {
    if (process.env.NODE_ENV === "production") throw new Error("ENCRYPTION_KEY não definida");
    return null;
  }
  const b = Buffer.from(k, "hex");
  if (b.length !== 32) throw new Error("ENCRYPTION_KEY deve ter 64 caracteres hexadecimais (openssl rand -hex 32)");
  return b;
}

export function cifrar(texto: string): string {
  const k = chave();
  if (!k) return texto;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return PREFIXO + Buffer.concat([iv, c.getAuthTag(), dados]).toString("base64");
}

export function decifrar(valor: string | null): string | null {
  if (valor == null || !valor.startsWith(PREFIXO)) return valor;
  const k = chave();
  if (!k) throw new Error("segredo criptografado, mas ENCRYPTION_KEY não está definida");
  const b = Buffer.from(valor.slice(PREFIXO.length), "base64");
  const d = createDecipheriv("aes-256-gcm", k, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}
