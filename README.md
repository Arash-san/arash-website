This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Local blog CMS

Blog posts live as versioned JSON documents in `content/blog`. Each document stores its metadata, article blocks, sources, and interactive lab positions. The public blog index and article routes read the same files, so there is one source of truth.

Run `npm run cms` and open `http://127.0.0.1:4310` to use the custom editor. It can create and update post files. The CMS listens only on the local loopback address and is separate from the static website bundle. Run `npm run dev -- --port 3001` in a second terminal when you want live article previews. No database or WordPress installation is required.

The first report uses native React labs from `components/blog`. A future post can use paragraph, heading, and callout blocks without code. A new interactive lab needs a React component and one entry in `components/blog/article-content.tsx`.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
