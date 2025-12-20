import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  to: string;
  subject: string;
  body: string;
  useHtml?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const { to, subject, body, useHtml }: SendEmailRequest = await req.json();

    console.log(`Sending email to: ${to}, subject: ${subject}`);

    if (!to) {
      throw new Error("Recipient email (to) is required");
    }

    if (!subject) {
      throw new Error("Subject is required");
    }

    if (!body) {
      throw new Error("Email body is required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      throw new Error("Invalid recipient email format");
    }

    // Send email using Resend SDK
    const emailResponse = await resend.emails.send({
      from: "Agent Builder Console <info@agentbuilderconsole.com>",
      to: [to],
      subject: subject,
      ...(useHtml ? { html: body } : { text: body }),
    });

    console.log("Resend API response:", JSON.stringify(emailResponse, null, 2));

    // Check if the email was actually accepted by Resend
    if (emailResponse.error) {
      console.error("Resend API error:", emailResponse.error);
      throw new Error(`Email sending failed: ${emailResponse.error.message || "Unknown error"}`);
    }

    if (!emailResponse.data?.id) {
      console.error("No message ID returned from Resend");
      throw new Error("Email sending failed: No message ID returned");
    }

    console.log(`Email sent successfully, message ID: ${emailResponse.data.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: emailResponse.data.id,
        message: `Email sent successfully to ${to}`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
