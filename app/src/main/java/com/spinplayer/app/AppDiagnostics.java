package com.spinplayer.app;
import android.content.Context;import java.io.*;import java.nio.charset.StandardCharsets;
final class AppDiagnostics {
 static synchronized void log(Context c,String event){try{File file=new File(c.getFilesDir(),"spin-app-report.txt");if(file.length()>300000){byte[] all=java.nio.file.Files.readAllBytes(file.toPath());int start=Math.max(0,all.length-150000);while(start<all.length&&all[start]!='\n')start++;try(FileOutputStream out=new FileOutputStream(file)){out.write(all,Math.min(start+1,all.length),Math.max(0,all.length-start-1));}}String line=java.time.Instant.now()+" "+event.replace('\n',' ').replace('\r',' ')+"\n";try(FileOutputStream out=new FileOutputStream(file,true)){out.write(line.getBytes(StandardCharsets.UTF_8));}}catch(Exception ignored){}}
 static synchronized String snapshot(Context c){try{return "SPIN Player 0.3.5 | Android API="+android.os.Build.VERSION.SDK_INT+"\nNo cookies, media URLs, search text or lyrics bodies are recorded.\n"+new String(java.nio.file.Files.readAllBytes(new File(c.getFilesDir(),"spin-app-report.txt").toPath()),StandardCharsets.UTF_8);}catch(Exception e){return "SPIN Player 0.3.5 | Journal empty";}}
}
