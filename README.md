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

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Netlify Supabase configuration

The POS cloud login reads Supabase settings from a Netlify function at `/.netlify/functions/supabase-config`.

Set these Netlify environment variables for the production site:

- `SUPABASE_URL`: your Supabase project URL, for example `https://your-project-ref.supabase.co`
- `SUPABASE_ANON_KEY`: the public anon key or publishable key from Supabase Project Settings > API

The app also accepts `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY`, or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as fallbacks. Do not use the Supabase `service_role` key in Netlify or in `supabase-config.js`.

## Supabase password recovery configuration

In Supabase Authentication > URL Configuration:

- Site URL: set this to the deployed ERP site root, for example `https://your-netlify-site.netlify.app`
- Redirect URLs: add the password reset page, for example `https://your-netlify-site.netlify.app/reset-password.html`

The login page sends password recovery emails with `redirectTo` set to `${window.location.origin}/reset-password.html`, so each deployed domain must be allow-listed in Supabase Redirect URLs.
