import Foundation
import Security
import Observation

public actor KeychainTokenStore: TokenProviding {
  private let service = "com.danielsihyun.drinkr"
  private struct StoredSession: Codable { let accessToken: String; let refreshToken: String; let expiresAt: Date }
  public init() {}
  public func token() async throws -> String {
    if let session = try loadSession() {
      if session.expiresAt > Date().addingTimeInterval(60) { return session.accessToken }
      return try await refresh(session)
    }
    // One-time compatibility path for installations from before refresh-token support.
    guard let legacy = try load(account: "access-token"), !isExpired(legacy) else { clear(); throw AppError.unauthorized }
    return legacy
  }
  public func save(accessToken: String, refreshToken: String, expiresIn: TimeInterval) throws { let value = StoredSession(accessToken: accessToken, refreshToken: refreshToken, expiresAt: Date().addingTimeInterval(expiresIn)); let data = try JSONEncoder().encode(value); try save(data, account: "session"); SecItemDelete([kSecClass:kSecClassGenericPassword,kSecAttrService:service,kSecAttrAccount:"access-token"] as CFDictionary) }
  public func clear() { for account in ["session", "access-token"] { SecItemDelete([kSecClass:kSecClassGenericPassword,kSecAttrService:service,kSecAttrAccount:account] as CFDictionary) } }
  private func refresh(_ session: StoredSession) async throws -> String {
    guard let url = UserDefaults.standard.string(forKey: "drinkr.supabaseURL"), let endpoint = URL(string: url), let key = UserDefaults.standard.string(forKey: "drinkr.supabaseAnonKey"), !key.isEmpty else { throw AppError.unauthorized }
    var components = URLComponents(url: endpoint.appending(path: "auth/v1/token"), resolvingAgainstBaseURL: false)!; components.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
    var request = URLRequest(url: components.url!); request.httpMethod = "POST"; request.setValue("application/json", forHTTPHeaderField: "Content-Type"); request.setValue(key, forHTTPHeaderField: "apikey"); request.httpBody = try JSONEncoder().encode(["refresh_token": session.refreshToken])
    do { let (data, response) = try await URLSession.shared.data(for: request); guard let http = response as? HTTPURLResponse else { throw AppError.offline }; guard 200..<300 ~= http.statusCode else { clear(); throw AppError.unauthorized }; let reply = try JSONDecoder().decode(AuthReply.self, from: data); try save(accessToken: reply.access_token, refreshToken: reply.refresh_token, expiresIn: reply.expires_in); return reply.access_token } catch let error as AppError { throw error } catch { throw AppError.offline }
  }
  private func loadSession() throws -> StoredSession? { guard let value = try load(account: "session") else { return nil }; return try? JSONDecoder().decode(StoredSession.self, from: Data(value.utf8)) }
  private func load(account: String) throws -> String? { let query:[CFString:Any] = [kSecClass:kSecClassGenericPassword,kSecAttrService:service,kSecAttrAccount:account,kSecReturnData:true]; var result:CFTypeRef?; let status=SecItemCopyMatching(query as CFDictionary,&result); if status == errSecItemNotFound { return nil }; guard status == errSecSuccess, let data=result as? Data, let value=String(data:data,encoding:.utf8) else { throw AppError.unauthorized }; return value }
  private func save(_ data: Data, account: String) throws { let q:[CFString:Any]=[kSecClass:kSecClassGenericPassword,kSecAttrService:service,kSecAttrAccount:account]; SecItemDelete(q as CFDictionary); var add=q; add[kSecValueData]=data; guard SecItemAdd(add as CFDictionary,nil)==errSecSuccess else { throw AppError.server("Unable to store session") } }
  private func isExpired(_ token: String) -> Bool { let parts=token.split(separator:"."); guard parts.count == 3 else { return true }; var payload=String(parts[1]).replacingOccurrences(of:"-",with:"+").replacingOccurrences(of:"_",with:"/"); payload += String(repeating:"=",count:(4-payload.count % 4) % 4); guard let data=Data(base64Encoded:payload), let object=try? JSONSerialization.jsonObject(with:data) as? [String:Any], let exp=object["exp"] as? TimeInterval else { return true }; return Date(timeIntervalSince1970:exp) <= Date().addingTimeInterval(60) }
}

@MainActor @Observable public final class SessionModel {
  public private(set) var signedIn=false; public private(set) var error:String?
  private let store=KeychainTokenStore()
  public init() { Task { signedIn = (try? await store.token()) != nil } }
  public func signIn(url:String,anonKey:String,email:String,password:String) async { guard let endpoint=URL(string:url), !anonKey.isEmpty, !email.isEmpty, !password.isEmpty else { self.error="Enter your email and password."; return }; do { var components=URLComponents(url:endpoint.appending(path:"auth/v1/token"),resolvingAgainstBaseURL:false)!; components.queryItems=[URLQueryItem(name:"grant_type",value:"password")]; var r=URLRequest(url:components.url!); r.httpMethod="POST"; r.setValue("application/json",forHTTPHeaderField:"Content-Type"); r.setValue(anonKey,forHTTPHeaderField:"apikey"); r.httpBody=try JSONEncoder().encode(["email":email,"password":password]); let(data,response)=try await URLSession.shared.data(for:r); guard let http=response as? HTTPURLResponse else { throw AppError.offline }; guard http.statusCode==200 else { let reply=try? JSONDecoder().decode(AuthErrorReply.self,from:data); throw AppError.server(reply?.messageText ?? "Sign-in request failed (HTTP \(http.statusCode)).") }; let reply=try JSONDecoder().decode(AuthReply.self,from:data); try await store.save(accessToken:reply.access_token,refreshToken:reply.refresh_token,expiresIn:reply.expires_in); signedIn=true; self.error=nil } catch let error as AppError { self.error=error.localizedDescription } catch { self.error="Sign-in failed. Check your email and password." } }
  public func signUp(url:String, anonKey:String, email:String, password:String) async { await authRequest(url: url, anonKey: anonKey, path: "auth/v1/signup", body: ["email": email, "password": password], success: "Check your email to confirm your account.") }
  public func resetPassword(url:String, anonKey:String, email:String) async { await authRequest(url: url, anonKey: anonKey, path: "auth/v1/recover", body: ["email": email], success: "If that account exists, a reset email is on its way.") }
  private func authRequest(url:String, anonKey:String, path:String, body:[String:String], success:String) async { guard let endpoint=URL(string:url), !anonKey.isEmpty, !body.values.contains(where: { $0.isEmpty }) else { self.error="Enter the required details."; return }; do { var request=URLRequest(url:endpoint.appending(path:path)); request.httpMethod="POST"; request.setValue("application/json",forHTTPHeaderField:"Content-Type"); request.setValue(anonKey,forHTTPHeaderField:"apikey"); request.httpBody=try JSONEncoder().encode(body); let(data,response)=try await URLSession.shared.data(for:request); guard let http=response as? HTTPURLResponse,200..<300 ~= http.statusCode else { let reply=try? JSONDecoder().decode(AuthErrorReply.self,from:data); throw AppError.server(reply?.messageText ?? "Request failed.") }; self.error=success } catch let failure as AppError { self.error=failure.localizedDescription } catch { self.error="Request failed. Try again." } }
  public func signOut(){ Task { await store.clear() }; signedIn=false }
}
private struct AuthReply:Decodable{let access_token:String;let refresh_token:String;let expires_in:TimeInterval}
private struct AuthErrorReply: Decodable { let msg:String?; let message:String?; var messageText:String? { msg ?? message } }
