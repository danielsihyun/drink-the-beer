#if canImport(SwiftUI)
import SwiftUI

struct AccountSettingsScreen: View {
  let client: APIClient?
  let onDeleted: () -> Void
  @State private var confirmDelete = false
  @State private var deleting = false
  @State private var error: String?
  var body: some View { Form {
    Section("Privacy") { Label("Your photos are private by default.", systemImage: "lock.shield"); Text("Only you and accepted friends can view your feed, profile history, and signed media. Blocking or removing a friend revokes access.").font(.footnote).foregroundStyle(.secondary) }
    Section("Account") { Text("Account deletion permanently removes your profile and drink history.").font(.footnote).foregroundStyle(.secondary); Button("Delete account", role: .destructive) { confirmDelete = true }.disabled(deleting) }
    if let error { Section { Text(error).foregroundStyle(.red) } }
  }.navigationTitle("Privacy & account").confirmationDialog("Delete your account permanently?", isPresented: $confirmDelete, titleVisibility: .visible) { Button("Delete account", role: .destructive) { Task { await deleteAccount() } } } message: { Text("This permanently removes your profile and drink history. This cannot be undone.") }.overlay { if deleting { ProgressView() } } }
  private func deleteAccount() async { guard let client else { error = "Set the API base URL in Profile."; return }; deleting = true; defer { deleting = false }; do { try await client.deleteAccount(); onDeleted() } catch { self.error = error.localizedDescription } }
}
#endif
