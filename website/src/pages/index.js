import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';

export default function Home() {
  return (
    <Layout title="API Kit" description="Production-grade API client for web, React Native and Node.js">
      <main className="container margin-vert--xl">
        <h1>API Kit</h1>
        <p>Token lifecycle, race-safe refresh and storage adapters for API clients.</p>
        <Link className="button button--primary button--lg" to="/docs/intro">
          Read the docs
        </Link>
      </main>
    </Layout>
  );
}
