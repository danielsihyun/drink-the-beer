import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Drink The Beer',
    short_name: 'DTB',
    description: 'Track your drinks with friends',
    start_url: '/feed',
    scope: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
  }
}