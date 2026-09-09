import Foundation

/// Production endpoints used by the native client. The publishable Supabase
/// key is intentionally a client credential; it is protected by RLS and the
/// user's Bearer token, not by secrecy.
enum DrinkrConfiguration {
  static let apiURL = "https://drink-the-beer.vercel.app/api"
  static let supabaseURL = "https://msscvaomiexmpgfvhian.supabase.co"
  static let supabasePublishableKey = "sb_publishable_SuUQI3GVFusPe1t6OcLVTA_9h0yj6ZL"

  static func registerDefaults() {
    UserDefaults.standard.register(defaults: [
      "drinkr.apiURL": apiURL,
      "drinkr.supabaseURL": supabaseURL,
      "drinkr.supabaseAnonKey": supabasePublishableKey
    ])
  }
}
