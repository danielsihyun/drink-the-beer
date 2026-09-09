import Foundation
import Security
import Observation

public actor KeychainTokenStore: TokenProviding {
  private let service = "com.danielsihyun.drinkr"
  public init() {}
  public func token() async throws -> String {
    let query:[CFString:Any] = [kSecClass:kSecClassGenericPassword,kSecAttrService:service,kSecAttrAccount:"access-token",kSecReturnData:true]
    var result:CFTypeRef?; let status=SecItemCopyMatching(query as CFDictionary,&result)
    guard status == errSecSuccess, let data=result as? Data, let value=String(data:data,encoding:.utf8) else { throw AppError.unauthorized }; return value
  }
  public func save(_ token:String) throws { let data=Data(token.utf8); let q:[CFString:Any]=[kSecClass:kSecClassGenericPassword,kSecAttrService:service,kSecAttrAccount:"access-token"]; SecItemDelete(q as CFDictionary); var add=q; add[kSecValueData]=data; guard SecItemAdd(add as CFDictionary,nil)==errSecSuccess else { throw AppError.server("Unable to store session") } }
  public func clear() { SecItemDelete([kSecClass:kSecClassGenericPassword,kSecAttrService:service,kSecAttrAccount:"access-token"] as CFDictionary) }
}

@MainActor @Observable public final class SessionModel {
  public private(set) var signedIn=false; public private(set) var error:String?
  private let store=KeychainTokenStore()
  public init() { Task { signedIn = (try? await store.token()) != nil } }
  public func signIn(url:String,anonKey:String,email:String,password:String) async { guard let endpoint=URL(string:url), !anonKey.isEmpty, !email.isEmpty, !password.isEmpty else { self.error="Enter your email and password."; return }; do { var components=URLComponents(url:endpoint.appending(path:"auth/v1/token"),resolvingAgainstBaseURL:false)!; components.queryItems=[URLQueryItem(name:"grant_type",value:"password")]; var r=URLRequest(url:components.url!); r.httpMethod="POST"; r.setValue("application/json",forHTTPHeaderField:"Content-Type"); r.setValue(anonKey,forHTTPHeaderField:"apikey"); r.httpBody=try JSONEncoder().encode(["email":email,"password":password]); let(data,response)=try await URLSession.shared.data(for:r); guard let http=response as? HTTPURLResponse else { throw AppError.offline }; guard http.statusCode==200 else { let reply=try? JSONDecoder().decode(AuthErrorReply.self,from:data); throw AppError.server(reply?.messageText ?? "Sign-in request failed (HTTP \(http.statusCode)).") }; let token=try JSONDecoder().decode(AuthReply.self,from:data).access_token; try await store.save(token); signedIn=true; self.error=nil } catch let error as AppError { self.error=error.localizedDescription } catch { self.error="Sign-in failed. Check your email and password." } }
  public func signUp(url:String, anonKey:String, email:String, password:String) async { await authRequest(url: url, anonKey: anonKey, path: "auth/v1/signup", body: ["email": email, "password": password], success: "Check your email to confirm your account.") }
  public func resetPassword(url:String, anonKey:String, email:String) async { await authRequest(url: url, anonKey: anonKey, path: "auth/v1/recover", body: ["email": email], success: "If that account exists, a reset email is on its way.") }
  private func authRequest(url:String, anonKey:String, path:String, body:[String:String], success:String) async { guard let endpoint=URL(string:url), !anonKey.isEmpty, !body.values.contains(where: { $0.isEmpty }) else { self.error="Enter the required details."; return }; do { var request=URLRequest(url:endpoint.appending(path:path)); request.httpMethod="POST"; request.setValue("application/json",forHTTPHeaderField:"Content-Type"); request.setValue(anonKey,forHTTPHeaderField:"apikey"); request.httpBody=try JSONEncoder().encode(body); let(data,response)=try await URLSession.shared.data(for:request); guard let http=response as? HTTPURLResponse,200..<300 ~= http.statusCode else { let reply=try? JSONDecoder().decode(AuthErrorReply.self,from:data); throw AppError.server(reply?.messageText ?? "Request failed.") }; self.error=success } catch let failure as AppError { self.error=failure.localizedDescription } catch { self.error="Request failed. Try again." } }
  public func signOut(){ Task { await store.clear() }; signedIn=false }
}
private struct AuthReply:Decodable{let access_token:String}
private struct AuthErrorReply: Decodable { let msg:String?; let message:String?; var messageText:String? { msg ?? message } }
