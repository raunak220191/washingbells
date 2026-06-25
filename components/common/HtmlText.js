/**
 * Tiny HTML renderer for T&C content. Handles the subset of tags TipTap
 * produces from the admin editor: h2, h3, p, strong, em, ul, ol, li, a, br.
 * No dependency on react-native-render-html or WebView.
 */
import { Text, View, Linking } from "react-native";

function decodeEntities(s) {
  return String(s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Parse the inline-text portion of a block into an array of {text, bold, italic, href} segments
function parseInline(html) {
  const segments = [];
  let i = 0, current = { text: "", bold: false, italic: false, href: null };
  const flush = () => {
    if (current.text) segments.push({ ...current });
    current = { text: "", bold: current.bold, italic: current.italic, href: current.href };
  };
  while (i < html.length) {
    if (html[i] === "<") {
      const close = html.indexOf(">", i);
      if (close === -1) { current.text += html.slice(i); break; }
      const tag = html.slice(i + 1, close).toLowerCase().trim();
      flush();
      if (tag === "br" || tag === "br/" || tag === "br /") current.text += "\n";
      else if (tag === "strong" || tag === "b") current.bold = true;
      else if (tag === "/strong" || tag === "/b") current.bold = false;
      else if (tag === "em" || tag === "i") current.italic = true;
      else if (tag === "/em" || tag === "/i") current.italic = false;
      else if (tag.startsWith("a ")) {
        const m = tag.match(/href="([^"]+)"/);
        current.href = m ? m[1] : null;
      } else if (tag === "/a") current.href = null;
      i = close + 1;
    } else {
      const next = html.indexOf("<", i);
      const chunk = next === -1 ? html.slice(i) : html.slice(i, next);
      current.text += decodeEntities(chunk);
      i = next === -1 ? html.length : next;
    }
  }
  flush();
  return segments;
}

// Tokenise HTML into block-level items
function parseBlocks(html) {
  const blocks = [];
  const tagRegex = /<\/?(h2|h3|p|ul|ol|li)\b[^>]*>/gi;
  let m;
  // Walk the HTML one block at a time using a stream of tag positions
  const tokens = [];
  let last = 0;
  while ((m = tagRegex.exec(html)) !== null) {
    if (m.index > last) tokens.push({ type: "text", value: html.slice(last, m.index) });
    tokens.push({ type: "tag", value: m[0], name: m[1].toLowerCase(), closing: m[0].startsWith("</") });
    last = m.index + m[0].length;
  }
  if (last < html.length) tokens.push({ type: "text", value: html.slice(last) });

  let buffer = "";
  let blockTag = null;
  let listType = null; // "ul" | "ol"
  let listItems = [];

  const flushBlock = () => {
    if (blockTag === "li") {
      listItems.push(buffer.trim());
    } else if (blockTag) {
      blocks.push({ tag: blockTag, content: buffer.trim() });
    }
    buffer = "";
    blockTag = null;
  };

  for (const t of tokens) {
    if (t.type === "tag") {
      if (t.name === "ul" || t.name === "ol") {
        if (!t.closing) {
          listType = t.name;
          listItems = [];
        } else {
          blocks.push({ tag: listType, items: listItems });
          listType = null;
          listItems = [];
        }
      } else if (t.name === "li") {
        if (!t.closing) { blockTag = "li"; buffer = ""; }
        else flushBlock();
      } else { // h2, h3, p
        if (!t.closing) { blockTag = t.name; buffer = ""; }
        else flushBlock();
      }
    } else {
      buffer += t.value;
    }
  }
  return blocks;
}

const SEG_STYLE = (s, base) => {
  const style = [base];
  if (s.bold) style.push({ fontWeight: "700" });
  if (s.italic) style.push({ fontStyle: "italic" });
  if (s.href) style.push({ textDecorationLine: "underline", color: "#1976D2" });
  return style;
};

function InlineSegments({ html, baseStyle }) {
  const segs = parseInline(html);
  return (
    <Text style={baseStyle}>
      {segs.map((s, i) => (
        <Text
          key={i}
          style={SEG_STYLE(s, baseStyle)}
          onPress={s.href ? () => Linking.openURL(s.href) : undefined}
        >
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

export default function HtmlText({ html, color = "#333", style }) {
  const blocks = parseBlocks(html || "");

  if (blocks.length === 0) {
    // Fallback: render the raw text with paragraph splits
    return (
      <Text style={[{ color, fontSize: 14, lineHeight: 22 }, style]}>
        {decodeEntities(html || "").replace(/<[^>]+>/g, "")}
      </Text>
    );
  }

  return (
    <View style={style}>
      {blocks.map((b, i) => {
        if (b.tag === "h2") return (
          <Text key={i} style={{ fontSize: 18, fontWeight: "800", color, marginTop: 16, marginBottom: 8 }}>
            <InlineSegments html={b.content} baseStyle={{ fontSize: 18, fontWeight: "800", color }} />
          </Text>
        );
        if (b.tag === "h3") return (
          <Text key={i} style={{ fontSize: 15, fontWeight: "700", color, marginTop: 12, marginBottom: 6 }}>
            <InlineSegments html={b.content} baseStyle={{ fontSize: 15, fontWeight: "700", color }} />
          </Text>
        );
        if (b.tag === "p") return (
          <View key={i} style={{ marginBottom: 8 }}>
            <InlineSegments html={b.content} baseStyle={{ fontSize: 14, lineHeight: 22, color }} />
          </View>
        );
        if (b.tag === "ul" || b.tag === "ol") return (
          <View key={i} style={{ marginVertical: 8, paddingLeft: 8 }}>
            {(b.items || []).map((item, j) => (
              <View key={j} style={{ flexDirection: "row", marginBottom: 4 }}>
                <Text style={{ fontSize: 14, lineHeight: 22, color, width: 24 }}>
                  {b.tag === "ul" ? "• " : `${j + 1}. `}
                </Text>
                <View style={{ flex: 1 }}>
                  <InlineSegments html={item} baseStyle={{ fontSize: 14, lineHeight: 22, color }} />
                </View>
              </View>
            ))}
          </View>
        );
        return null;
      })}
    </View>
  );
}
