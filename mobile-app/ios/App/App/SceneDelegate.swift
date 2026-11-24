import UIKit
import WebKit
import CryptoKit
import Capacitor

struct LiveEstimatorRouter: Router {
    var basePath: String = ""
    let liveIndexPath: String

    func route(for path: String) -> String {
        let pathUrl = URL(fileURLWithPath: path)
        let isRoot = pathUrl.pathExtension.isEmpty || path == "/index.html"
        if isRoot {
            if FileManager.default.fileExists(atPath: liveIndexPath) {
                return liveIndexPath
            }
            return basePath + "/index.html"
        }
        return basePath + path
    }
}

final class WeakEstimatorScriptHandler: NSObject, WKScriptMessageHandler {
    private weak var target: WKScriptMessageHandler?

    init(target: WKScriptMessageHandler) {
        self.target = target
        super.init()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}

final class LiveEstimatorBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {
    private let primaryHtmlUrl = "https://raw.githubusercontent.com/websprodigital/antrian-gambar-estimator/gh-pages/index.html"
    private let fallbackHtmlUrl = "https://websprodigital.github.io/antrian-gambar-estimator/index.html"
    private let prefsPrefix = "EstimatorLiveWeb_"
    private let syncQueue = DispatchQueue(label: "com.websprodigital.antrianestimator.livehtml")
    private var lastAutoCheckTime: TimeInterval = 0

    private var liveWebDir: URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        return appSupport.appendingPathComponent("live-web", isDirectory: true)
    }

    private var liveIndexURL: URL {
        return liveWebDir.appendingPathComponent("index.html")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
            self?.triggerAutoCheckIfNeeded()
        }
    }

    override func router() -> Router {
        ensureLiveCacheMatchesBinary()
        return LiveEstimatorRouter(liveIndexPath: liveIndexURL.path)
    }

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        config.userContentController.add(WeakEstimatorScriptHandler(target: self), name: "EstimatorIOS")
        return config
    }

    func triggerAutoCheckIfNeeded() {
        let now = Date().timeIntervalSince1970
        if now - lastAutoCheckTime < 30 {
            return
        }
        lastAutoCheckTime = now
        syncLiveHtml(fromManual: false, reloadOnOk: false)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        if action == "checkAndRefresh" {
            syncLiveHtml(fromManual: true, reloadOnOk: true)
        } else if action == "checkLiveUpdate" {
            syncLiveHtml(fromManual: true, reloadOnOk: false)
        } else if action == "openExternal", let rawUrl = body["url"] as? String,
                  let targetUrl = URL(string: rawUrl.trimmingCharacters(in: .whitespacesAndNewlines)) {
            DispatchQueue.main.async {
                UIApplication.shared.open(targetUrl, options: [:], completionHandler: nil)
            }
        }
    }

    private func sha256Hex(_ data: Data) -> String {
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    private func bundledIndexHash() -> String {
        if let bundledUrl = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "public"),
           let data = try? Data(contentsOf: bundledUrl) {
            return sha256Hex(data)
        }
        return ""
    }

    private func currentActiveHash() -> String {
        if FileManager.default.fileExists(atPath: liveIndexURL.path),
           let data = try? Data(contentsOf: liveIndexURL) {
            return sha256Hex(data)
        }
        return bundledIndexHash()
    }

    private func ensureLiveCacheMatchesBinary() {
        let defaults = UserDefaults.standard
        let currentBundled = bundledIndexHash()
        let savedBundled = defaults.string(forKey: prefsPrefix + "bundledHash") ?? ""
        if !currentBundled.isEmpty && !savedBundled.isEmpty && currentBundled != savedBundled {
            try? FileManager.default.removeItem(at: liveIndexURL)
            defaults.set(currentBundled, forKey: prefsPrefix + "bundledHash")
            defaults.set("", forKey: prefsPrefix + "liveHash")
            defaults.set("", forKey: prefsPrefix + "updatedAt")
        } else if !currentBundled.isEmpty && savedBundled.isEmpty {
            defaults.set(currentBundled, forKey: prefsPrefix + "bundledHash")
        }
    }

    private func isValidPortalHtml(_ html: String) -> Bool {
        guard html.count >= 20000 else { return false }
        let lower = html.lowercased()
        guard lower.contains("<html"), lower.contains("</body>"), lower.contains("</html>") else {
            return false
        }
        return html.contains("GOOGLE_SCRIPT_WEB_APP_URL") || html.contains("loginScreen")
    }

    private func transformLiveHtml(_ rawHtml: String) -> String {
        var html = rawHtml
        if let regex = try? NSRegularExpression(
            pattern: "<meta\\s+name=[\"']viewport[\"']\\s+content=[\"']([^\"']*)[\"']\\s*/?>",
            options: [.caseInsensitive]
        ) {
            let fullRange = NSRange(html.startIndex..<html.endIndex, in: html)
            if let match = regex.firstMatch(in: html, options: [], range: fullRange),
               let contentRange = Range(match.range(at: 1), in: html) {
                let content = String(html[contentRange])
                if !content.contains("viewport-fit=cover") {
                    let replacement = "<meta name=\"viewport\" content=\"\(content), viewport-fit=cover\">"
                    if let wholeRange = Range(match.range(at: 0), in: html) {
                        html.replaceSubrange(wholeRange, with: replacement)
                    }
                }
            }
        }
        if !html.contains("native-bridge.js") {
            if let closeRange = html.range(of: "</body>", options: [.backwards, .caseInsensitive]) {
                html.insert(contentsOf: "  <script src=\"native-bridge.js\"></script>\n", at: closeRange.lowerBound)
            }
        }
        return html
    }

    private func downloadHtmlSynchronously(from baseUrl: String) -> String? {
        let sep = baseUrl.contains("?") ? "&" : "?"
        let ms = Int(Date().timeIntervalSince1970 * 1000)
        guard let url = URL(string: "\(baseUrl)\(sep)live_t=\(ms)") else { return nil }

        var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 8.0)
        req.setValue("no-cache, no-store, must-revalidate", forHTTPHeaderField: "Cache-Control")
        req.setValue("no-cache", forHTTPHeaderField: "Pragma")

        let semaphore = DispatchSemaphore(value: 0)
        var fetchedHtml: String?
        let task = URLSession.shared.dataTask(with: req) { data, response, _ in
            defer { semaphore.signal() }
            if let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode),
               let data = data, let text = String(data: data, encoding: .utf8) {
                fetchedHtml = text
            }
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 9.0)
        return fetchedHtml
    }

    private func syncLiveHtml(fromManual: Bool, reloadOnOk: Bool) {
        syncQueue.async { [weak self] in
            guard let self = self else { return }

            var validRaw: String?
            var usedUrl = ""
            for candidateUrl in [self.primaryHtmlUrl, self.fallbackHtmlUrl] {
                if let txt = self.downloadHtmlSynchronously(from: candidateUrl), self.isValidPortalHtml(txt) {
                    validRaw = txt
                    usedUrl = candidateUrl
                    break
                }
            }

            guard let rawHtml = validRaw else {
                self.notifyWebStatus(ok: false, status: "offline", updated: false, hash: "", fromManual: fromManual, reloadOnOk: false)
                return
            }

            let transformed = self.transformLiveHtml(rawHtml)
            guard let transformedData = transformed.data(using: .utf8) else {
                self.notifyWebStatus(ok: false, status: "error", updated: false, hash: "", fromManual: fromManual, reloadOnOk: false)
                return
            }

            let nextHash = self.sha256Hex(transformedData)
            let activeHash = self.currentActiveHash()

            if !nextHash.isEmpty && nextHash == activeHash {
                self.notifyWebStatus(ok: true, status: "up-to-date", updated: false, hash: nextHash, fromManual: fromManual, reloadOnOk: reloadOnOk)
                return
            }

            do {
                try FileManager.default.createDirectory(at: self.liveWebDir, withIntermediateDirectories: true, attributes: nil)
                let tmpUrl = self.liveWebDir.appendingPathComponent("index.html.tmp")
                try transformedData.write(to: tmpUrl, options: .atomic)
                if FileManager.default.fileExists(atPath: self.liveIndexURL.path) {
                    _ = try FileManager.default.replaceItemAt(self.liveIndexURL, withItemAt: tmpUrl)
                } else {
                    try FileManager.default.moveItem(at: tmpUrl, to: self.liveIndexURL)
                }

                let defaults = UserDefaults.standard
                defaults.set(self.bundledIndexHash(), forKey: self.prefsPrefix + "bundledHash")
                defaults.set(nextHash, forKey: self.prefsPrefix + "liveHash")
                defaults.set(ISO8601DateFormatter().string(from: Date()), forKey: self.prefsPrefix + "updatedAt")
                defaults.set(usedUrl, forKey: self.prefsPrefix + "sourceUrl")

                self.notifyWebStatus(ok: true, status: "updated", updated: true, hash: nextHash, fromManual: fromManual, reloadOnOk: reloadOnOk)
            } catch {
                self.notifyWebStatus(ok: false, status: "error", updated: false, hash: "", fromManual: fromManual, reloadOnOk: false)
            }
        }
    }

    private func notifyWebStatus(ok: Bool, status: String, updated: Bool, hash: String, fromManual: Bool, reloadOnOk: Bool) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            if reloadOnOk && ok {
                if let serverUrl = self.bridge?.config.appStartServerURL {
                    let req = URLRequest(url: serverUrl, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData)
                    self.webView?.load(req)
                } else {
                    self.webView?.reload()
                }
                return
            }

            let payload: [String: Any] = [
                "ok": ok,
                "status": status,
                "updated": updated,
                "hash": hash,
                "fromManualRefresh": fromManual
            ]
            guard let jsonData = try? JSONSerialization.data(withJSONObject: payload, options: []),
                  let jsonStr = String(data: jsonData, encoding: .utf8) else { return }

            if ok && updated {
                self.bridge?.eval(js: "if (typeof window.__estimatorOnLiveUpdateAvailable === 'function') { window.__estimatorOnLiveUpdateAvailable(\(jsonStr)); }")
            } else if fromManual {
                self.bridge?.eval(js: "if (typeof window.__estimatorOnLiveRefreshStatus === 'function') { window.__estimatorOnLiveRefreshStatus(\(jsonStr)); }")
            }
        }
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private weak var liveBridgeVC: LiveEstimatorBridgeViewController?
    private var didInitialActivate = false

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let vc = LiveEstimatorBridgeViewController()
        liveBridgeVC = vc
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = vc
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        if !didInitialActivate {
            didInitialActivate = true
            return
        }
        liveBridgeVC?.triggerAutoCheckIfNeeded()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
