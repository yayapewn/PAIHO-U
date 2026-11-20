interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface ApiResponse {
  status: (code: number) => {
    json: (payload: unknown) => void;
  };
}

interface PaletteChipPayload {
  hex: string;
  code: string;
  percentage: number;
}

interface PartRowPayload {
  partName: string;
  materialTitle?: string;
  colorCode: string;
  hex: string;
}

interface SendEmailBody {
  to?: string;
  modelName?: string;
  designer?: string;
  colorMode?: string;
  backdropLabel?: string;
  attachmentBase64?: string;
  attachmentFilename?: string;
  paletteChips?: PaletteChipPayload[];
  partRows?: PartRowPayload[];
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 6;
const MAX_ATTACHMENT_BASE64_LENGTH = 5_000_000;

const ipHits = new Map<string, number[]>();

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeColorHex = (hex: string): string => {
  const clean = hex.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(clean) ? clean : '#4F46E5';
};

const getClientIp = (headers: Record<string, string | string[] | undefined>): string => {
  const forwarded = headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (raw) {
    return raw.split(',')[0].trim();
  }
  const realIp = headers['x-real-ip'];
  return (Array.isArray(realIp) ? realIp[0] : realIp) || 'local';
};

const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  const timestamps = (ipHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    ipHits.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  ipHits.set(ip, timestamps);

  if (ipHits.size > 500) {
    for (const [key, list] of ipHits.entries()) {
      if (list.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) {
        ipHits.delete(key);
      }
    }
  }
  return true;
};

const buildHtmlEmail = ({
  modelName,
  designer,
  colorMode,
  backdropLabel,
  paletteChips,
  partRows,
}: {
  modelName: string;
  designer: string;
  colorMode: string;
  backdropLabel: string;
  paletteChips: PaletteChipPayload[];
  partRows: PartRowPayload[];
}): string => {
  const safeModel = escapeHtml(modelName.toUpperCase());
  const safeDesigner = escapeHtml(designer);
  const safeMode = escapeHtml(colorMode);
  const safeBackdrop = escapeHtml(backdropLabel);

  const paletteHtml = paletteChips.length
    ? `
      <div style="margin-top:20px;padding:16px;border:1px solid #e5e7eb;background:#f9fafb;">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.16em;color:#4f46e5;text-transform:uppercase;margin-bottom:10px;">
          Color DNA (${safeMode})
        </div>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
          ${paletteChips
            .map(
              (chip) => `
            <tr>
              <td style="padding:4px 0;font-size:13px;font-weight:700;color:#111827;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${sanitizeColorHex(
                  chip.hex
                )};border:1px solid rgba(17,24,39,0.2);margin-right:8px;vertical-align:middle;"></span>
                ${escapeHtml(chip.code)}
              </td>
              <td align="right" style="padding:4px 0;font-size:13px;font-weight:800;color:#4f46e5;">
                ${Math.round(chip.percentage)}%
              </td>
            </tr>
          `
            )
            .join('')}
        </table>
      </div>
    `
    : '';

  const partsHtml = partRows.length
    ? `
      <div style="margin-top:16px;padding:16px;border:1px solid #e5e7eb;background:#ffffff;">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.16em;color:#111827;text-transform:uppercase;margin-bottom:10px;">
          Customized Parts (${partRows.length})
        </div>
        <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
          ${partRows
            .slice(0, 12)
            .map(
              (row) => `
            <tr>
              <td style="padding:5px 0;font-size:12px;font-weight:800;color:#111827;border-bottom:1px solid #f3f4f6;">
                ${escapeHtml(row.partName)}
              </td>
              <td style="padding:5px 8px;font-size:12px;color:#4b5563;border-bottom:1px solid #f3f4f6;">
                ${escapeHtml(row.materialTitle || 'Custom Color Finish')}
              </td>
              <td align="right" style="padding:5px 0;font-size:12px;font-weight:700;color:#111827;border-bottom:1px solid #f3f4f6;white-space:nowrap;">
                <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${sanitizeColorHex(
                  row.hex
                )};border:1px solid rgba(17,24,39,0.2);margin-right:6px;vertical-align:middle;"></span>
                ${escapeHtml(row.colorCode)}
              </td>
            </tr>
          `
            )
            .join('')}
        </table>
      </div>
    `
    : '';

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;padding:24px;background:#ffffff;color:#111827;">
      <div style="border-bottom:2px solid #4f46e5;padding-bottom:12px;margin-bottom:20px;">
        <div style="font-size:11px;font-weight:800;letter-spacing:0.24em;color:#6b7280;text-transform:uppercase;">
          PAIHO-U DIGITAL DESIGN WORKSPACE
        </div>
        <h1 style="margin:6px 0 0;font-size:22px;font-weight:900;letter-spacing:0.08em;color:#111827;">
          ${safeModel} · STUDIO DESIGN RENDER
        </h1>
      </div>

      <p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#374151;">
        Designer: <strong>${safeDesigner}</strong> &nbsp;·&nbsp; Backdrop: <strong>${safeBackdrop}</strong> &nbsp;·&nbsp; Format: <strong>${safeMode}</strong>
      </p>

      <div style="border:1px solid #e5e7eb;background:#f9fafb;padding:8px;">
        <img src="cid:design-render" alt="${safeModel} Studio Design Render" style="display:block;width:100%;height:auto;" />
      </div>

      ${paletteHtml}
      ${partsHtml}

      <div style="margin-top:24px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;letter-spacing:0.08em;text-transform:uppercase;">
        Sent from PAIHO-U Digital Design Workspace · High-resolution render attached
      </div>
    </div>
  `;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' });
    return;
  }

  const clientIp = getClientIp(req.headers);
  if (!checkRateLimit(clientIp)) {
    res.status(429).json({
      error: 'RATE_LIMITED',
      message: 'Too many requests. Please wait a moment before sending another email.',
    });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({
      error: 'EMAIL_SERVICE_NOT_CONFIGURED',
      message: 'Email service is not configured yet (RESEND_API_KEY missing).',
    });
    return;
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) as SendEmailBody;
  const recipient = (body.to || '').trim();

  if (!recipient || recipient.length > 254 || !EMAIL_REGEX.test(recipient)) {
    res.status(400).json({
      error: 'INVALID_EMAIL',
      message: 'Please enter a valid recipient email address.',
    });
    return;
  }

  const attachmentBase64 = (body.attachmentBase64 || '').replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim();
  if (!attachmentBase64) {
    res.status(400).json({
      error: 'MISSING_ATTACHMENT',
      message: 'Design render image is required.',
    });
    return;
  }

  if (attachmentBase64.length > MAX_ATTACHMENT_BASE64_LENGTH || !/^[A-Za-z0-9+/=]+$/.test(attachmentBase64)) {
    res.status(400).json({
      error: 'INVALID_ATTACHMENT',
      message: 'Design render attachment is invalid or exceeds size limit.',
    });
    return;
  }

  const modelName = (body.modelName || 'Footwear Design').trim().slice(0, 80);
  const designer = (body.designer || '').trim().slice(0, 64) || 'PAIHO-U Studio';
  const colorMode = (body.colorMode || 'HEX').trim().slice(0, 12);
  const backdropLabel = (body.backdropLabel || 'Pure White').trim().slice(0, 40);
  const paletteChips = Array.isArray(body.paletteChips) ? body.paletteChips.slice(0, 12) : [];
  const partRows = Array.isArray(body.partRows) ? body.partRows.slice(0, 24) : [];

  const safeSlug = modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'paiho-u';
  const attachmentFilename = (body.attachmentFilename || `${safeSlug}-design-render.jpg`)
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .slice(0, 80);

  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'PAIHO-U Studio <onboarding@resend.dev>';
  const subject = `[PAIHO-U Design] ${modelName.toUpperCase()} — ${designer}`;

  const textSummary = [
    `PAIHO-U Digital Design Workspace`,
    `Model: ${modelName.toUpperCase()}`,
    `Designer: ${designer}`,
    `Color Format: ${colorMode}`,
    paletteChips.length
      ? `Color DNA: ${paletteChips.map((c) => `${c.code} (${Math.round(c.percentage)}%)`).join(' · ')}`
      : '',
    partRows.length
      ? `Parts:\n${partRows.map((p) => `- ${p.partName}: ${p.materialTitle || 'Custom Color Finish'} (${p.colorCode})`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const html = buildHtmlEmail({
    modelName,
    designer,
    colorMode,
    backdropLabel,
    paletteChips,
    partRows,
  });

  try {
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject,
        html,
        text: textSummary,
        attachments: [
          {
            filename: attachmentFilename,
            content: attachmentBase64,
            content_id: 'design-render',
          },
        ],
      }),
    });

    const resendData = (await resendResponse.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };

    if (!resendResponse.ok) {
      res.status(resendResponse.status >= 400 ? resendResponse.status : 502).json({
        error: resendData.name || 'EMAIL_PROVIDER_ERROR',
        message: resendData.message || 'Failed to deliver email via provider.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      id: resendData.id || null,
    });
  } catch (error) {
    console.error('[api/send-email] Unexpected error:', error);
    res.status(500).json({
      error: 'EMAIL_SEND_FAILED',
      message: 'Unable to connect to email delivery service.',
    });
  }
}
