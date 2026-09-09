// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "Drinkr", platforms: [.iOS(.v17), .macOS(.v14)], products: [.library(name: "DrinkrApp", targets: ["DrinkrApp"])], targets: [.target(name: "DrinkrApp", path: "Sources/DrinkrApp"), .testTarget(name: "DrinkrAppTests", dependencies: ["DrinkrApp"], path: "Tests/DrinkrAppTests")])
