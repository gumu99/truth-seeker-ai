import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, content, options } = await req.json();

    if (!content || content.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Content too short" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    let articleText = content;

    // Step 1: If URL, scrape the page first
    if (type === "url" && FIRECRAWL_API_KEY) {
      try {
        let formattedUrl = content.trim();
        if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
          formattedUrl = `https://${formattedUrl}`;
        }
        console.log("Scraping URL:", formattedUrl);
        const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: formattedUrl,
            formats: ["markdown"],
            onlyMainContent: true,
          }),
        });
        const scrapeData = await scrapeResp.json();
        if (scrapeResp.ok && (scrapeData?.data?.markdown || scrapeData?.markdown)) {
          articleText = scrapeData?.data?.markdown || scrapeData?.markdown;
          console.log("Scraped article length:", articleText.length);
        }
      } catch (e) {
        console.error("Scrape failed, using raw URL as text:", e);
      }
    }

    // Step 2: Search the internet for related articles
    let searchResults = "";
    if (FIRECRAWL_API_KEY) {
      try {
        // Extract a search query from the content
        const searchQuery = type === "headline" 
          ? content.trim()
          : content.trim().substring(0, 200);

        console.log("Searching for:", searchQuery.substring(0, 80));
        const searchResp = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: searchQuery,
            limit: 5,
          }),
        });
        const searchData = await searchResp.json();
        if (searchResp.ok && searchData?.data) {
          searchResults = searchData.data
            .map((r: any, i: number) => `[Source ${i + 1}] ${r.title || "No title"}\nURL: ${r.url || "N/A"}\n${r.description || ""}`)
            .join("\n\n");
          console.log("Found", searchData.data.length, "search results");
        }
      } catch (e) {
        console.error("Search failed:", e);
      }
    }

    // Step 3: AI Analysis with Lovable AI Gateway
    const systemPrompt = `You are a professional fact-checking AI engine. You analyze news articles, headlines, and text for misinformation, bias, clickbait, and credibility.

You MUST respond with a JSON object using this EXACT tool call format. Analyze the content thoroughly considering:
- Factual consistency with known credible sources
- Propaganda signals and emotional manipulation
- Misleading framing and logical fallacies
- Source credibility and reliability
- Headline exaggeration and clickbait patterns
- Cross-reference with the provided search results from the internet

Be rigorous and evidence-based. If search results confirm the claims, lean toward REAL. If they contradict or the content uses manipulative language, lean toward FAKE or MISLEADING.`;

    const userPrompt = `Analyze this ${type === "headline" ? "headline" : type === "url" ? "article (scraped from URL)" : "news text"} for misinformation:

--- CONTENT TO ANALYZE ---
${articleText.substring(0, 4000)}

--- INTERNET SEARCH RESULTS FOR CROSS-REFERENCE ---
${searchResults || "No search results available."}
---

Provide your verdict.`;

    const aiBody: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "provide_analysis",
            description: "Provide the fact-check analysis results",
            parameters: {
              type: "object",
              properties: {
                verdict: { type: "string", enum: ["REAL", "FAKE", "MISLEADING"], description: "The overall verdict" },
                confidence: { type: "number", description: "Confidence score 0-100" },
                sourceReliability: { type: "string", enum: ["Very Low", "Low", "Medium", "High", "Excellent"], description: "How reliable the sources are" },
                biasDeviation: { type: "string", enum: ["Negligible", "Minimal", "Low", "Medium", "Significant", "Extreme"], description: "Level of bias detected" },
                clickbaitIndex: { type: "number", description: "Clickbait score 0-100" },
                factMatches: { type: "string", description: "Number of verified facts, e.g. '7/10'" },
                summary: { type: "string", description: "Detailed analysis summary explaining the verdict, 2-4 sentences" },
                flags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Array of detected flags like 'clickbait', 'emotional manipulation', 'unverified claims', 'conspiracy', 'satire', 'propaganda'"
                },
              },
              required: ["verdict", "confidence", "sourceReliability", "biasDeviation", "clickbaitIndex", "factMatches", "summary", "flags"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "provide_analysis" } },
    };

    console.log("Calling Lovable AI Gateway...");
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiBody),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      throw new Error(`AI gateway error: ${aiResp.status}`);
    }

    const aiData = await aiResp.json();
    console.log("AI response received");

    // Extract tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured analysis");
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    // Parse search results into structured format for frontend
    const relatedArticles = [];
    if (searchResults) {
      const sourceBlocks = searchResults.split("\n\n");
      for (const block of sourceBlocks) {
        const titleMatch = block.match(/\[Source \d+\] (.+)/);
        const urlMatch = block.match(/URL: (.+)/);
        const descMatch = block.match(/URL: .+\n(.*)/);
        if (titleMatch && urlMatch && urlMatch[1] !== "N/A") {
          const url = urlMatch[1].trim();
          let sourceName = "Unknown";
          try {
            sourceName = new URL(url).hostname.replace("www.", "").split(".")[0];
            sourceName = sourceName.charAt(0).toUpperCase() + sourceName.slice(1);
          } catch {}
          relatedArticles.push({
            title: titleMatch[1].trim(),
            url,
            source: sourceName,
            description: descMatch?.[1]?.trim() || "",
          });
        }
      }
    }

    return new Response(JSON.stringify({ ...analysis, relatedArticles }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-news error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
