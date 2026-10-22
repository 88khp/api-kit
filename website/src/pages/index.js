import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import CodeBlock from '@theme/CodeBlock';

const features = [
  {
    "title": "Tokens attached for you",
    "body": "Every request gets the Bearer token without you writing an interceptor."
  },
  {
    "title": "Silent refresh",
    "body": "When a token expires, the client refreshes it and retries the request."
  },
  {
    "title": "Race-safe refresh",
    "body": "However many requests fail at once, the client makes one refresh call and queues the rest."
  },
  {
    "title": "Works everywhere",
    "body": "One client for the web, React Native and Node.js, with pluggable token storage."
  }
];
const steps = [
  {
    "title": "Configure once",
    "code": "ApiClient.getInstance({ baseURL })"
  },
  {
    "title": "Make requests",
    "code": "client.get<User>('/api/me')"
  },
  {
    "title": "Handle sign-out",
    "code": "onAuthFailure: () => …"
  }
];
const code = "import { ApiClient } from '@88khp/api-kit';\n\nApiClient.getInstance({\n  baseURL: 'https://api.example.com',\n  storage: myStorage,\n  hooks: { onAuthFailure: () => router.push('/login') },\n});\n\n// Tokens attach, refresh and retry on their own.\nconst { data } = await client.get<User>('/api/me');";

const Art = () => (
  <svg viewBox="0 0 480 360" role="img" aria-label="A request, a response and a token refresh">
    <defs>
      <linearGradient id="artBg" x1="0" y1="0" x2="1" y2="1">
        <stop className="art-s1" offset="0" />
        <stop className="art-s2" offset="1" />
      </linearGradient>
      <filter id="artShadow" x="-25%" y="-25%" width="150%" height="170%">
        <feDropShadow dx="0" dy="14" stdDeviation="14" floodOpacity="0.28" />
      </filter>
    </defs>
    <rect x="0" y="0" width="480" height="360" rx="28" fill="url(#artBg)" />
    <path className="art-dash" d="M226 110 C 270 120, 236 206, 262 232" />
    <rect className="art-card" x="52" y="60" width="180" height="84" rx="20" filter="url(#artShadow)" />
    <rect className="art-accent" x="72" y="84" width="56" height="26" rx="13" />
    <rect className="art-bar" x="142" y="92" width="72" height="10" rx="5" />
    <rect className="art-bar" x="72" y="118" width="120" height="8" rx="4" />
    <rect className="art-card" x="262" y="168" width="176" height="136" rx="20" filter="url(#artShadow)" />
    <rect className="art-bar-strong" x="284" y="192" width="72" height="18" rx="9" />
    <rect className="art-bar" x="284" y="226" width="130" height="8" rx="4" />
    <rect className="art-bar" x="284" y="246" width="100" height="8" rx="4" />
    <rect className="art-bar" x="284" y="266" width="120" height="8" rx="4" />
    <circle className="art-accent" cx="378" cy="92" r="32" filter="url(#artShadow)" />
    <path className="art-check" d="M364 92 L375 103 L394 82" />
    <text className="art-mark" x="36" y="332">88khp / api-kit</text>
  </svg>
);

export default function Home() {
  return (
    <Layout title="An API client that handles auth for you" description="Token attachment, silent refresh and race-safe retries. Built once, correct everywhere, on the web, React Native and Node.js.">
      <header className="hero">
        <div className="container">
          <div className="hero__text">
          <span className="hero__eyebrow">api-kit</span>
          <h1 className="hero__title">An API client that handles auth for you</h1>
          <p className="hero__lede">Token attachment, silent refresh and race-safe retries. Built once, correct everywhere, on the web, React Native and Node.js.</p>
          <div className="hero__install">
            <span className="prompt">$</span>
            <code>npm install @88khp/api-kit</code>
          </div>
          <div className="hero__actions">
            <Link className="btn btn--primary" to="/docs/getting-started">Install</Link>
            <Link className="btn" to="/docs/intro">Read the docs</Link>
          </div>
          </div>
          <div className="hero__art"><Art /></div>
        </div>
      </header>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <h2>How it fits together</h2>
          </div>
          <ol className="steps">
            {steps.map((s, i) => (
              <li className="step" key={s.title}>
                <span className="step__num">{i + 1}</span>
                <div>
                  <h3 className="step__title">{s.title}</h3>
                  <code className="step__code">{s.code}</code>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section--tint">
        <div className="container split">
          <div>
            <h2>Use it</h2>
            <p className="section__body">Configure the client once. After that, every request handles its own token.</p>
          </div>
          <div className="split__code">
            <CodeBlock language="ts" title="api.ts">{code}</CodeBlock>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <h2>Why it's worth using</h2>
          </div>
          <div className="features__grid">
            {features.map((f) => (
              <div className="feature" key={f.title}>
                <h3 className="feature__title">{f.title}</h3>
                <p className="feature__body">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container cta__inner">
          <h2>Start with the docs</h2>
          <div className="hero__actions">
            <Link className="btn btn--primary" to="/docs/intro">Open the docs</Link>
            <a className="btn" href="https://github.com/88khp/api-kit">View on GitHub</a>
          </div>
        </div>
      </section>
    </Layout>
  );
}
