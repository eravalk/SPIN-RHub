package com.spinplayer.app;

import android.content.Context;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.*;
import org.json.*;

/** Embeds spotDL's original matching modules using the already verified ARM64 Python runtime. */
final class SpotDLMatcher {
 final Context context;
 final YtDlpEngine engine;
 final YtDlpEngine.Events events;
 File directory;
 SpotDLMatcher(Context c,YtDlpEngine.Events e){context=c;events=e;engine=new YtDlpEngine(c,e);}
 static String sha(InputStream input)throws Exception{try(InputStream in=input){MessageDigest hash=MessageDigest.getInstance("SHA-256");byte[] b=new byte[65536];int n;while((n=in.read(b))!=-1)hash.update(b,0,n);StringBuilder out=new StringBuilder();for(byte x:hash.digest())out.append(String.format(Locale.ROOT,"%02x",x&255));return out.toString();}}
 static synchronized File ensure(Context context)throws Exception{
  JSONObject manifest=new JSONObject(YtDlpEngine.asset(context,"spotdl-manifest.json"));String hash=manifest.getString("bundle_sha256");if(!hash.matches("[a-f0-9]{64}"))throw new IOException("SpotDLManifestInvalid");
  File root=new File(context.getNoBackupFilesDir(),"spotdl-4.6.0-"+hash.substring(0,12));File ready=new File(root,"ready");
  if(!ready.isFile()){
   if(!sha(context.getAssets().open("spotdl-runtime.zip")).equals(hash))throw new IOException("SpotDLBundleMismatch");
   YtDlpEngine.delete(root);root.mkdirs();String prefix=root.getCanonicalPath()+File.separator;
   try(ZipInputStream zip=new ZipInputStream(context.getAssets().open("spotdl-runtime.zip"))){ZipEntry entry;byte[] b=new byte[65536];while((entry=zip.getNextEntry())!=null){File target=new File(root,entry.getName());if(!target.getCanonicalPath().startsWith(prefix))throw new IOException("SpotDLPathInvalid");if(entry.isDirectory()){target.mkdirs();continue;}target.getParentFile().mkdirs();try(OutputStream out=new FileOutputStream(target)){int n;while((n=zip.read(b))!=-1)out.write(b,0,n);}}}
   ready.createNewFile();
  }
  File script=new File(root,"spin_match.py");String source=YtDlpEngine.asset(context,"spotdl-match.py");byte[] bytes=source.getBytes(StandardCharsets.UTF_8);
  if(!script.isFile()||!sha(new FileInputStream(script)).equals(sha(new ByteArrayInputStream(bytes)))){
   File part=new File(root,"spin_match.py.part");try(OutputStream out=new FileOutputStream(part)){out.write(bytes);}if(!part.renameTo(script))throw new IOException("SpotDLScriptWriteFailed");new File(root,"self-test-ok").delete();
  }
  return root;
 }
 JSONObject run(JSONObject payload,boolean selfTest)throws Exception{
  ProcessBuilder builder=new ProcessBuilder(new File(engine.bin,"libpython.so").getAbsolutePath(),new File(directory,"spin_match.py").getAbsolutePath(),selfTest?"--self-test":"--match");
  builder.environment().putAll(engine.environment());builder.environment().put("PYTHONPATH",directory.getAbsolutePath()+File.pathSeparator+engine.engine.getAbsolutePath());builder.environment().put("PYTHONNOUSERSITE","1");builder.environment().put("RAPIDFUZZ_IMPLEMENTATION","python");
  Process process=builder.start();AtomicBoolean done=new AtomicBoolean(false);Thread drain=new Thread(()->{try(InputStream err=process.getErrorStream()){byte[] buffer=new byte[4096];while(err.read(buffer)!=-1){}}catch(IOException ignored){}});drain.setDaemon(true);drain.start();
  long start=System.nanoTime();Thread watchdog=new Thread(()->{while(!done.get()){if(events.cancelled()||System.nanoTime()-start>90000000000L){process.destroyForcibly();return;}try{Thread.sleep(200);}catch(InterruptedException e){return;}}});watchdog.setDaemon(true);watchdog.start();
  try{try(OutputStream input=process.getOutputStream()){if(payload!=null)input.write(payload.toString().getBytes(StandardCharsets.UTF_8));}String output;
   try(InputStream in=process.getInputStream();ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(out.size()+n>2*1024*1024)throw new IOException("SpotDLMetadataTooLarge");out.write(b,0,n);}output=out.toString("UTF-8");}
   if(events.cancelled())throw new IOException("SpotDLCancelled");if(process.waitFor()!=0)throw new IOException("SpotDLMatchFailed");JSONObject result=new JSONObject(output.trim());if(!"spotDL".equals(result.optString("engine")))throw new IOException("SpotDLResponseInvalid");return result;
  }finally{done.set(true);process.destroy();watchdog.interrupt();}
 }
 void init()throws Exception{engine.init();directory=ensure(context);File tested=new File(directory,"self-test-ok");if(!tested.isFile()){if(!run(null,true).optBoolean("self_test"))throw new IOException("SpotDLSelfTestFailed");tested.createNewFile();}}
 JSONArray candidates(JSONObject track)throws Exception{init();return run(new JSONObject().put("track",track),false).getJSONArray("items");}
 JSONArray rank(JSONObject track,JSONArray candidates)throws Exception{init();return run(new JSONObject().put("track",track).put("candidates",candidates),false).getJSONArray("items");}
}
