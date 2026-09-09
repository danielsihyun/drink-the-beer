import Foundation

/// Direct caller-bound read of `feed_page_v2`; no Vercel dependency.
public actor SupabaseFeedClient: FeedRepository {
  let url: URL; let publishableKey: String; let tokens: TokenProviding; let session: URLSession
  public init(url: URL, publishableKey: String, tokens: TokenProviding, session: URLSession = .shared) { self.url=url; self.publishableKey=publishableKey; self.tokens=tokens; self.session=session }
  public func feed(after cursor: Cursor?) async throws -> ([FeedPost], Cursor?) {
    let token=try await tokens.token(); let viewer=try JWTSubject.subject(from:token)
    var request=URLRequest(url:url.appending(path:"rest/v1/rpc/feed_page_v2")); request.httpMethod="POST"; request.setValue("application/json",forHTTPHeaderField:"Content-Type"); request.setValue(publishableKey,forHTTPHeaderField:"apikey"); request.setValue("Bearer \(token)",forHTTPHeaderField:"Authorization"); request.httpBody=try JSONEncoder.drinkr.encode(FeedRequest(p_viewer:viewer.uuidString,p_cursor:cursor?.encoded,p_limit:20)); let(data,response)=try await session.data(for:request); guard let http=response as? HTTPURLResponse,200..<300 ~= http.statusCode else { throw AppError.server("Unable to load feed") }; let page=try JSONDecoder.drinkr.decode(DirectFeedPage.self,from:data); return(page.posts,page.nextCursor)
  }
  public func cheer(_ id: UUID, _ desired: Bool, _ key: UUID) async throws { throw AppError.server("Cheers use the command API.") }
}
private struct DirectFeedPage:Decodable { let posts:[FeedPost]; let nextCursor:Cursor? }
private struct FeedRequest:Encodable { let p_viewer:String; let p_cursor:String?; let p_limit:Int }
private enum JWTSubject { static func subject(from token:String)throws->UUID { let parts=token.split(separator:"."); guard parts.count==3 else{throw AppError.unauthorized}; var value=String(parts[1]).replacingOccurrences(of:"-",with:"+").replacingOccurrences(of:"_",with:"/"); value += String(repeating:"=",count:(4-value.count%4)%4); struct Claims:Decodable{let sub:String}; guard let data=Data(base64Encoded:value),let claims=try? JSONDecoder().decode(Claims.self,from:data),let id=UUID(uuidString:claims.sub) else{throw AppError.unauthorized};return id } }
