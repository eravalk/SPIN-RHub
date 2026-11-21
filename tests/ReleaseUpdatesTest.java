package com.spinplayer.app;
import org.json.*;
public final class ReleaseUpdatesTest {
 static JSONObject release(String url) throws Exception {
  return new JSONObject().put("tag_name","v1.2.1.0").put("body","Changes")
   .put("assets",new JSONArray().put(new JSONObject().put("name","SPIN-RHub-1.2.1.0.apk")
    .put("size",123).put("state","uploaded").put("browser_download_url",url)));
 }
 static void expect(boolean value) {if(!value)throw new AssertionError();}
 public static void main(String[] args)throws Exception{
  String valid="https://github.com/eravalk/SPIN-RHub/releases/download/v1.2.1.0/SPIN-RHub-1.2.1.0.apk";
  expect(ReleaseUpdates.newer("1.10","1.9"));expect(!ReleaseUpdates.newer("1.2.0","1.2.0.0"));
  JSONObject result=ReleaseUpdates.evaluate(release(valid),"1.2.0.0");
  expect(result.getString("status").equals("available"));expect(result.getString("url").equals(valid));
  expect(result.getString("notes").equals("Changes"));
  for(String url:new String[]{"http://github.com/eravalk/SPIN-RHub/releases/download/v1.2.1.0/SPIN-RHub-1.2.1.0.apk",valid.replace("github.com","github.com.evil.example"),valid.replace("eravalk","other"),valid+"?redirect=evil"})
   expect(ReleaseUpdates.evaluate(release(url),"1.2.0.0").getString("status").equals("missing"));
  JSONObject prerelease=release(valid).put("prerelease",true);
  expect(ReleaseUpdates.evaluate(prerelease,"1.2.0.0").getString("status").equals("missing"));
  JSONObject malformed=release(valid);malformed.getJSONArray("assets").getJSONObject(0).put("digest","sha256:bad");
  expect(ReleaseUpdates.evaluate(malformed,"1.2.0.0").getString("status").equals("missing"));
  expect(ReleaseUpdates.evaluate(release(valid),"1.2.1.0").getString("status").equals("current"));
  expect(ReleaseUpdates.canonicalInstalled("1.1").equals("1.0.1.0"));
  expect(ReleaseUpdates.canonicalInstalled("1.2").equals("1.1.0.0"));
  expect(ReleaseUpdates.canonicalInstalled("1.3").equals("1.2.0.0"));
  expect(ReleaseUpdates.canonicalInstalled("1.2.0.0").equals("1.2.0.0"));
  expect(ReleaseUpdates.evaluate(release(valid),"1.3").getString("status").equals("available"));
  expect(ReleaseUpdates.evaluate(release(valid).put("tag_name","v1.4"),"1.3").getString("status").equals("missing"));
  expect(ReleaseUpdates.newer("1.2.0.1","1.2.0.0"));
  expect(ReleaseUpdates.newer("1.2.1.0","1.2.0.99"));
  expect(ReleaseUpdates.newer("1.3.0.0","1.2.99.99"));
  expect(ReleaseUpdates.newer("2.0.0.0","1.99.99.99"));
  System.out.println("PASS: release versions, APK metadata, exact repository/HTTPS URL, prerelease rejection and invalid digest");
 }
}
