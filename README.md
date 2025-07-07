# Misskey Mention Timeline Viewer

This is a single-page application (SPA) that retrieves and displays a Misskey antenna timeline and its conversation threads, based on the provided technical specification.

## Directory Layout (as per spec)

```
misskey-antennatl/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx              # root page (/)
│  │  └─ layout.tsx            # <html>
│  │  └─ api/
│  │     └─ mentionContext/
│  │        └─ route.ts       # Edge runtime
│  ├─ components/
│  ├─ lib/
│  ├─ styles/
│  └─ tests/
├─ public/
├─ .github/
├─ tsconfig.json
└─ README.md
```

## Setup & Usage (as per spec)

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Variables:**
    Copy the `.env.local.sample` to `.env.local` and fill in your Misskey host, token, and antenna ID.
    ```bash
    cp .env.local.sample .env.local
    ```

3.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
Upon launching, you will first see a list of recent antenna notes. Click on a note to view its context timeline (notes before and after it).

---

## Original Next.js README

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

### Getting Started

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

You can start editing the page by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

### Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

### Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.