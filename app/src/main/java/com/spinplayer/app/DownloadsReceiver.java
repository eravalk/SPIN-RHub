package com.spinplayer.app;
import android.content.*;
public class DownloadsReceiver extends BroadcastReceiver{public void onReceive(Context c,Intent i){if(!android.app.DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(i.getAction()))return;PendingResult result=goAsync();new Thread(()->{try{OnlineDownloads.state(c.getApplicationContext());}finally{result.finish();}},"spin-download-complete").start();}}
