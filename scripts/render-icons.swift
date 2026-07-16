#!/usr/bin/env swift

import AppKit
import Foundation

struct RenderJob {
  let source: String
  let output: String
  let size: Int
}

let jobs = [
  RenderJob(source: "icon.svg", output: "icon_16.png", size: 16),
  RenderJob(source: "icon.svg", output: "icon_32.png", size: 32),
  RenderJob(source: "icon.svg", output: "icon_48.png", size: 48),
  RenderJob(source: "icon.svg", output: "icon_128.png", size: 128),
  RenderJob(source: "action_active.svg", output: "action_active_16.png", size: 16),
  RenderJob(source: "action_active.svg", output: "action_active.png", size: 32),
  RenderJob(source: "action_inactive.svg", output: "action_inactive_16.png", size: 16),
  RenderJob(source: "action_inactive.svg", output: "action_inactive.png", size: 32),
  RenderJob(source: "action_unavailable.svg", output: "action_unavailable_16.png", size: 16),
  RenderJob(source: "action_unavailable.svg", output: "action_unavailable.png", size: 32),
]

let projectDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let sourceDirectory = projectDirectory.appendingPathComponent("scripts/icons", isDirectory: true)
let outputDirectory = projectDirectory.appendingPathComponent("public/icons", isDirectory: true)

func render(_ job: RenderJob) throws {
  let sourceURL = sourceDirectory.appendingPathComponent(job.source)
  let outputURL = outputDirectory.appendingPathComponent(job.output)

  guard let image = NSImage(contentsOf: sourceURL) else {
    throw NSError(domain: "ElementsIconRenderer", code: 1, userInfo: [
      NSLocalizedDescriptionKey: "Unable to load \(sourceURL.path)",
    ])
  }

  guard let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: job.size,
    pixelsHigh: job.size,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
  ) else {
    throw NSError(domain: "ElementsIconRenderer", code: 2, userInfo: [
      NSLocalizedDescriptionKey: "Unable to allocate \(job.size)x\(job.size) bitmap",
    ])
  }

  bitmap.size = NSSize(width: job.size, height: job.size)
  guard let context = NSGraphicsContext(bitmapImageRep: bitmap) else {
    throw NSError(domain: "ElementsIconRenderer", code: 3, userInfo: [
      NSLocalizedDescriptionKey: "Unable to create drawing context",
    ])
  }

  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = context
  context.imageInterpolation = .high
  NSColor.clear.setFill()
  NSRect(x: 0, y: 0, width: job.size, height: job.size).fill()
  image.draw(
    in: NSRect(x: 0, y: 0, width: job.size, height: job.size),
    from: NSRect(origin: .zero, size: image.size),
    operation: .copy,
    fraction: 1
  )
  context.flushGraphics()
  NSGraphicsContext.restoreGraphicsState()

  guard let png = bitmap.representation(using: .png, properties: [:]) else {
    throw NSError(domain: "ElementsIconRenderer", code: 4, userInfo: [
      NSLocalizedDescriptionKey: "Unable to encode \(job.output)",
    ])
  }
  try png.write(to: outputURL, options: .atomic)
  print("Rendered \(job.output) (\(job.size)x\(job.size))")
}

do {
  try jobs.forEach(render)
} catch {
  fputs("Icon rendering failed: \(error.localizedDescription)\n", stderr)
  exit(1)
}
