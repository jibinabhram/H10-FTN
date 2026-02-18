package com.tabbapp

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import android.os.Build
import com.facebook.react.bridge.*

class WifiModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var activeCallback: ConnectivityManager.NetworkCallback? = null

    override fun getName(): String = "WifiModule"

    @ReactMethod
    fun connectToWifi(ssid: String, password: String, promise: Promise) {
        val connectivityManager = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        
        activeCallback?.let {
            try {
                connectivityManager.unregisterNetworkCallback(it)
            } catch (e: Exception) {}
            activeCallback = null
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val specifierBuilder = WifiNetworkSpecifier.Builder()
                .setSsid(ssid)
            
            if (password.isNotEmpty()) {
                specifierBuilder.setWpa2Passphrase(password)
            }

            val wifiNetworkSpecifier = specifierBuilder.build()

            val networkRequest = NetworkRequest.Builder()
                .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                // CRITICAL: Tells Android NOT to expect or require internet on this network.
                // This prevents the system from automatically disconnecting or switching back 
                // to mobile data because the pod holder doesn't have internet.
                .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) 
                .setNetworkSpecifier(wifiNetworkSpecifier)
                .build()

            val callback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    super.onAvailable(network)
                    connectivityManager.bindProcessToNetwork(network)
                    promise.resolve("Connected to $ssid")
                }

                override fun onUnavailable() {
                    super.onUnavailable()
                    promise.reject("WIFI_ERROR", "Could not connect to $ssid")
                    activeCallback = null
                }
                
                override fun onLost(network: Network) {
                    super.onLost(network)
                    connectivityManager.bindProcessToNetwork(null)
                    activeCallback = null
                }
            }

            activeCallback = callback
            connectivityManager.requestNetwork(networkRequest, callback)
        } else {
            promise.reject("OS_NOT_SUPPORTED", "Auto-connect requires Android 10 or higher")
        }
    }

    @ReactMethod
    fun disconnectWifi(promise: Promise) {
        val connectivityManager = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                connectivityManager.bindProcessToNetwork(null)
            }
            
            activeCallback?.let {
                connectivityManager.unregisterNetworkCallback(it)
                activeCallback = null
            }
            
            promise.resolve("Disconnected")
        } catch (e: Exception) {
            promise.reject("DISCONNECT_ERROR", e.message)
        }
    }
}
