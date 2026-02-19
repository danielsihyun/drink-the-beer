import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'drinkr',
    short_name: 'drinkr',
    description: 'Track, analyze, and discover drinks with your friends!',
    start_url: '/feed',
    scope: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
  }
}