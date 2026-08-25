// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "LokinLocationCore",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(name: "LokinLocationCore", targets: ["LokinLocationCore"])
    ],
    targets: [
        .target(
            name: "LokinLocationCore",
            path: ".",
            exclude: [
                "Package.swift",
                "Info.location.plist.template",
                "LokinIntents.swift",
                "LokinShortcuts.swift",
                "LOKINAppIntents.swift.template",
                "LOKINUniversalLinkValidator.swift.template",
                "apple-app-site-association.template.json",
                "LokinWebViewDeepLinkBridge.swift"
            ],
            sources: [
                "LokinLocationModels.swift",
                "LokinLocationFilter.swift",
                "LokinLocationQueue.swift",
                "LokinSensorFusion.swift",
                "LokinLocationEngine.swift",
                "LokinLocationBridge.swift"
            ],
            linkerSettings: [
                .linkedLibrary("sqlite3")
            ]
        )
    ]
)
