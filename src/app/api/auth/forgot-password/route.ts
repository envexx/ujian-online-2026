import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

export const runtime = 'edge';

// Edge-compatible random token generation
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email harus diisi' },
        { status: 400 }
      );
    }

    // Check if user exists (only ADMIN and GURU can reset via email)
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user || (user.role !== 'ADMIN' && user.role !== 'GURU')) {
      return NextResponse.json({
        success: true,
        message: 'Jika email terdaftar, link reset password akan dikirim ke email Anda.',
      });
    }

    // Generate token using Edge-compatible crypto
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing tokens for this email
    await prisma.passwordResetToken.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    // Create new token
    await prisma.passwordResetToken.create({
      data: {
        email,
        token,
        expiresAt,
      },
    });

    // Try to send email via Resend
    try {
      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

      await sendEmail({
        to: email,
        subject: 'Reset Password - E-Learning',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #0221CD; margin: 0;">E-Learning</h1>
              <p style="color: #666; margin-top: 5px;">Reset Password</p>
            </div>
            <div style="background: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
              <h2 style="color: #333; margin-top: 0;">Halo,</h2>
              <p style="color: #555; line-height: 1.6;">
                Kami menerima permintaan untuk mereset password akun Anda. 
                Klik tombol di bawah untuk membuat password baru:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" 
                   style="background: #0221CD; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color: #888; font-size: 13px;">
                Link ini akan kadaluarsa dalam <strong>1 jam</strong>. 
                Jika Anda tidak meminta reset password, abaikan email ini.
              </p>
              <p style="color: #888; font-size: 12px; margin-top: 20px;">
                Atau copy link berikut ke browser:<br/>
                <a href="${resetUrl}" style="color: #0221CD; word-break: break-all;">${resetUrl}</a>
              </p>
            </div>
            <p style="color: #aaa; font-size: 11px; text-align: center;">
              Email ini dikirim otomatis oleh sistem E-Learning. Jangan membalas email ini.
            </p>
          </div>
        `,
      });

      console.log(`Password reset email sent to ${email}`);
    } catch (emailError) {
      // Email sending failed, but token is still created
      console.error('Failed to send reset email:', emailError);
      console.log(`[FALLBACK] Password reset token for ${email}: ${token}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Jika email terdaftar, link reset password akan dikirim ke email Anda.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan. Silakan coba lagi.' },
      { status: 500 }
    );
  }
}
