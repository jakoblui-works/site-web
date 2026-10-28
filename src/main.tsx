import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './styles.css'

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

// Register things for typesafety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

// Built pages hold a prerendered copy of `/` (see `prerender.tsx`), for crawlers. It isn't
// hydrated: TanStack Router renders a different tree on the server unless it's set up for SSR.
// `createRoot` replaces it with a fresh render, exactly as on an empty page.
const root = ReactDOM.createRoot(rootElement)
root.render(<RouterProvider router={router} />)
