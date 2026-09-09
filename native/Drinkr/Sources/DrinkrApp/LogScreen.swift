#if canImport(SwiftUI)
import SwiftUI
#if canImport(PhotosUI)
import PhotosUI
#endif
#if canImport(UIKit)
import UIKit
#endif

/// Native equivalent of the web log flow: select/capture an image, choose a catalog
/// drink (or category), save a durable outbox record, then publish through the v2 API.
struct LogScreen: View {
  @AppStorage("drinkr.apiURL") private var apiURL = ""
  @State private var drinkType = "Beer"
  @State private var drinkID: UUID?
  @State private var drinkName = ""
  @State private var caption = ""
  @State private var takenAt = Date()
  @State private var logger: DrinkLogger?
  @State private var searchText = ""
  @State private var results: [DrinkCatalogItem] = []
  @State private var searchError: String?
  @State private var searching = false
  @State private var showCamera = false
  @State private var cameraError: String?
  @State private var customName = ""
  @State private var showingCustomDrink = false
  @State private var creatingCustomDrink = false
  #if canImport(UIKit)
  @State private var pendingPhotoData: Data?
  @State private var showingCropEditor = false
  #endif
  #if canImport(PhotosUI)
  @State private var selection: PhotosPickerItem?
  #endif

  private let token = KeychainTokenStore()
  private let drinkTypes = ["Beer", "Seltzer", "Wine", "Cocktail", "Shot", "Spirit", "Other"]

  var body: some View {
    NavigationStack {
      Form {
        Section("Photo") {
          HStack {
            #if canImport(PhotosUI)
            PhotosPicker(selection: $selection, matching: .images) {
              Label("Photo library", systemImage: "photo.on.rectangle")
            }
            #endif
            Button { showCamera = true } label: { Label("Camera", systemImage: "camera") }
          }
          Text("A photo is required. It is saved on this device before upload, so a failed upload can be retried.")
            .font(.footnote).foregroundStyle(.secondary)
          if let cameraError { Text(cameraError).font(.footnote).foregroundStyle(.red) }
        }

        Section("Drink") {
          TextField("Search drinks", text: $searchText)
            .onSubmit { Task { await search() } }
          if searching { ProgressView("Searching") }
          ForEach(results) { result in
            Button {
              drinkID = result.id
              drinkName = result.name
              drinkType = drinkTypes.contains(result.category ?? "") ? result.category! : "Other"
              searchText = ""
              results = []
            } label: {
              HStack { Text(result.name); Spacer(); Text(result.category ?? "Other").foregroundStyle(.secondary) }
            }
          }
          if let searchError { Text(searchError).font(.footnote).foregroundStyle(.red) }
          Button(showingCustomDrink ? "Cancel custom drink" : "Can't find it? Create custom drink") {
            showingCustomDrink.toggle()
            customName = ""
          }
          if showingCustomDrink {
            TextField("Drink name", text: $customName)
            Picker("Custom category", selection: $drinkType) { ForEach(drinkTypes, id: \.self) { Text($0) } }
            Button("Create custom drink") { Task { await createCustomDrink() } }
              .disabled(creatingCustomDrink || customName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            if creatingCustomDrink { ProgressView("Creating drink…") }
          }
          if !drinkName.isEmpty {
            LabeledContent("Selected", value: drinkName)
            Button("Clear selected drink", role: .destructive) { drinkID = nil; drinkName = "" }
          }
          Picker("Category", selection: $drinkType) { ForEach(drinkTypes, id: \.self) { Text($0) } }
          Text("You can publish an unlisted drink by selecting a category without selecting a catalog result.")
            .font(.footnote).foregroundStyle(.secondary)
        }

        Section("Details") {
          DatePicker("When", selection: $takenAt, displayedComponents: [.date, .hourAndMinute])
          TextField("Caption (optional)", text: $caption, axis: .vertical)
            .lineLimit(2...5)
          Text("\(caption.count)/280").font(.caption).foregroundStyle(caption.count > 280 ? .red : .secondary)
        }

        if let logger {
          Section("Upload outbox") {
            if logger.drafts.isEmpty {
              Text("Choose a photo to make a draft.").foregroundStyle(.secondary)
            }
            ForEach(logger.drafts) { draft in
              DraftRow(draft: draft, working: logger.working, publish: { Task { await logger.publish(draft, apiURL: apiURL) } }, discard: { Task { await logger.discard(draft) } })
            }
            if !logger.drafts.isEmpty {
              Button("Retry all pending") { Task { await logger.retryAll(apiURL: apiURL) } }
                .disabled(logger.working)
            }
          }
          if let message = logger.message { Section { Text(message).font(.footnote).foregroundStyle(.secondary) } }
        }
      }
      .navigationTitle("Log drink")
      .toolbar { ToolbarItem { Button { Task { await search() } } label: { Image(systemName: "magnifyingglass") }.disabled(searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || searching) } }
      .task { if logger == nil { logger = try? DrinkLogger(); await logger?.load() } }
      #if canImport(PhotosUI)
      .onChange(of: selection) { _, item in
        guard let item else { return }
        Task {
          defer { selection = nil }
          do {
            guard let data = try await item.loadTransferable(type: Data.self) else { throw AppError.server("That photo could not be read.") }
            beginEditing(data)
          } catch { cameraError = error.localizedDescription }
        }
      }
      #endif
      .sheet(isPresented: $showCamera) { CameraPicker { result in
        showCamera = false
        switch result {
        case .success(let data): beginEditing(data)
        case .failure(let error): cameraError = error.localizedDescription
        }
      } }
      #if canImport(UIKit)
      .sheet(isPresented: $showingCropEditor) {
        if let pendingPhotoData, let image = UIImage(data: pendingPhotoData) {
          PhotoCropEditor(image: image) { result in
            showingCropEditor = false
            self.pendingPhotoData = nil
            switch result {
            case .success(let data): Task { await logger?.savePhoto(data, caption: caption, drinkID: drinkID, drinkType: drinkType, takenAt: takenAt) }
            case .failure(let error): cameraError = error.localizedDescription
            }
          }
        }
      }
      #endif
    }
  }

  private func search() async {
    let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard query.count >= 1 else { results = []; return }
    guard let url = URL(string: apiURL), !apiURL.isEmpty else { searchError = "Set the API base URL in Profile first."; return }
    searching = true; defer { searching = false }
    do { results = try await APIClient(baseURL: url, tokens: token).searchDrinks(query); searchError = nil }
    catch { searchError = error.localizedDescription; results = [] }
  }

  private func createCustomDrink() async {
    let name = customName.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !name.isEmpty else { return }
    guard let url = URL(string: apiURL), !apiURL.isEmpty else { searchError = "Set the API base URL in Profile first."; return }
    creatingCustomDrink = true; defer { creatingCustomDrink = false }
    do {
      let created = try await APIClient(baseURL: url, tokens: token).createCustomDrink(name: name, category: drinkType)
      drinkID = created.id; drinkName = created.name; customName = ""; showingCustomDrink = false; searchError = nil
    } catch { searchError = error.localizedDescription }
  }

  private func beginEditing(_ data: Data) {
    #if canImport(UIKit)
    pendingPhotoData = data
    showingCropEditor = true
    #else
    Task { await logger?.savePhoto(data, caption: caption, drinkID: drinkID, drinkType: drinkType, takenAt: takenAt) }
    #endif
  }
}

private struct DraftRow: View {
  let draft: Draft; let working: Bool; let publish: () -> Void; let discard: () -> Void
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text(draft.drinkType).font(.headline)
      Text(draft.takenAt, style: .date).font(.caption).foregroundStyle(.secondary)
      Text(draft.state.rawValue.capitalized).font(.caption).foregroundStyle(draft.state == .failed ? .red : .secondary)
      if let error = draft.lastError { Text(error).font(.caption).foregroundStyle(.red) }
      HStack { Button(draft.state == .failed ? "Retry" : "Publish", action: publish).disabled(working); Button("Discard", role: .destructive, action: discard).disabled(working) }
    }
  }
}

#if canImport(UIKit)
/// A local square crop editor. The crop is applied before the durable outbox stores
/// the JPEG, so retries always publish precisely the image the user approved.
private struct PhotoCropEditor: View {
  let image: UIImage
  let completion: (Result<Data, Error>) -> Void
  @State private var scale: CGFloat = 1
  @State private var offset: CGSize = .zero
  @State private var dragStart: CGSize = .zero
  @State private var canvasSide: CGFloat = 300
  @Environment(\.dismiss) private var dismiss
  var body: some View {
    NavigationStack {
      GeometryReader { geometry in
        let side = min(geometry.size.width, geometry.size.height)
        let base = max(side / image.size.width, side / image.size.height)
        ZStack {
          Color.black.ignoresSafeArea()
          Image(uiImage: image).resizable().scaledToFit()
            .frame(width: image.size.width * base * scale, height: image.size.height * base * scale)
            .offset(offset)
            .gesture(DragGesture().onChanged { value in offset = CGSize(width: dragStart.width + value.translation.width, height: dragStart.height + value.translation.height) }.onEnded { _ in dragStart = offset })
          Rectangle().stroke(.white, lineWidth: 2).frame(width: side, height: side).allowsHitTesting(false)
        }.frame(maxWidth: .infinity, maxHeight: .infinity)
          .onAppear { canvasSide = side }
          .onChange(of: side) { _, newValue in canvasSide = newValue }
      }
      .safeAreaInset(edge: .bottom) {
        VStack(spacing: 12) {
          HStack { Image(systemName: "minus.magnifyingglass"); Slider(value: $scale, in: 1...4); Image(systemName: "plus.magnifyingglass") }
          Text("Drag to position, then save the square crop.").font(.footnote).foregroundStyle(.secondary)
        }.padding().background(.regularMaterial)
      }
      .navigationTitle("Crop photo").navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
        ToolbarItem(placement: .confirmationAction) { Button("Use photo") { completion(crop()) } }
      }
    }
  }
  private func crop() -> Result<Data, Error> {
    let width = image.size.width, height = image.size.height
    guard width > 0, height > 0 else { return .failure(AppError.server("That photo could not be read.")) }
    let side = min(width, height) / scale
    // The preview uses a centered aspect-fill image; convert its point offset back
    // into source-image pixels and clamp it to valid crop bounds.
    let previewBase = max(canvasSide / width, canvasSide / height) * scale
    var x = (width - side) / 2 - offset.width / previewBase
    var y = (height - side) / 2 - offset.height / previewBase
    x = min(max(0, x), width - side); y = min(max(0, y), height - side)
    guard let cg = image.cgImage?.cropping(to: CGRect(x: x * image.scale, y: y * image.scale, width: side * image.scale, height: side * image.scale)) else { return .failure(AppError.server("Could not crop this photo.")) }
    guard let data = UIImage(cgImage: cg, scale: image.scale, orientation: .up).jpegData(compressionQuality: 0.92) else { return .failure(AppError.server("Could not save this crop.")) }
    return .success(data)
  }
}

private struct CameraPicker: UIViewControllerRepresentable {
  let completion: (Result<Data, Error>) -> Void
  func makeCoordinator() -> Coordinator { Coordinator(completion: completion) }
  func makeUIViewController(context: Context) -> UIImagePickerController {
    let picker = UIImagePickerController()
    guard UIImagePickerController.isSourceTypeAvailable(.camera) else { DispatchQueue.main.async { completion(.failure(AppError.server("Camera is not available on this device."))) }; return picker }
    picker.sourceType = .camera; picker.cameraCaptureMode = .photo; picker.delegate = context.coordinator
    return picker
  }
  func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
  final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
    let completion: (Result<Data, Error>) -> Void; init(completion: @escaping (Result<Data, Error>) -> Void) { self.completion = completion }
    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { picker.dismiss(animated: true) }
    func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey : Any]) { picker.dismiss(animated: true); guard let image = info[.originalImage] as? UIImage, let data = image.jpegData(compressionQuality: 0.92) else { completion(.failure(AppError.server("Camera image could not be read."))); return }; completion(.success(data)) }
  }
}
#else
private struct CameraPicker: View { let completion: (Result<Data, Error>) -> Void; var body: some View { ContentUnavailableView("Camera unavailable", systemImage: "camera") } }
#endif
#endif
