import AppKit
import Foundation
import PDFKit

guard CommandLine.arguments.count >= 3 else {
    FileHandle.standardError.write(
        "usage: swift render_pdf_pages.swift <input.pdf> <output-dir> [scale]\n".data(using: .utf8)!
    )
    exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
let scale = CommandLine.arguments.count >= 4 ? (Double(CommandLine.arguments[3]) ?? 2.0) : 2.0

try FileManager.default.createDirectory(at: outputURL, withIntermediateDirectories: true)

guard let document = PDFDocument(url: inputURL) else {
    FileHandle.standardError.write("failed to open PDF: \(inputURL.path)\n".data(using: .utf8)!)
    exit(1)
}

for pageIndex in 0..<document.pageCount {
    guard let page = document.page(at: pageIndex) else {
        continue
    }

    let bounds = page.bounds(for: .mediaBox)
    let pixelWidth = Int((bounds.width * scale).rounded())
    let pixelHeight = Int((bounds.height * scale).rounded())

    guard let bitmap = NSBitmapImageRep(
        bitmapDataPlanes: nil,
        pixelsWide: pixelWidth,
        pixelsHigh: pixelHeight,
        bitsPerSample: 8,
        samplesPerPixel: 4,
        hasAlpha: true,
        isPlanar: false,
        colorSpaceName: .deviceRGB,
        bytesPerRow: 0,
        bitsPerPixel: 0
    ) else {
        FileHandle.standardError.write("failed to allocate bitmap for page \(pageIndex + 1)\n".data(using: .utf8)!)
        exit(1)
    }

    guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
        FileHandle.standardError.write("failed to create graphics context for page \(pageIndex + 1)\n".data(using: .utf8)!)
        exit(1)
    }

    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = context
    let cgContext = context.cgContext
    cgContext.setFillColor(NSColor.white.cgColor)
    cgContext.fill(CGRect(x: 0, y: 0, width: pixelWidth, height: pixelHeight))
    cgContext.scaleBy(x: scale, y: scale)
    page.draw(with: .mediaBox, to: cgContext)
    NSGraphicsContext.restoreGraphicsState()

    guard let png = bitmap.representation(using: .png, properties: [:]) else {
        FileHandle.standardError.write("failed to encode PNG for page \(pageIndex + 1)\n".data(using: .utf8)!)
        exit(1)
    }

    let filename = String(format: "slide-%02d.png", pageIndex + 1)
    try png.write(to: outputURL.appendingPathComponent(filename))
}

print("rendered \(document.pageCount) pages to \(outputURL.path)")
