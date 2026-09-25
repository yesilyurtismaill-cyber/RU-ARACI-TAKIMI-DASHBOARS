(() => {

  "use strict";


  let loginBusy = false;
  let dashboardLoading = false;


  function qs(selector) {
    return document.querySelector(selector);
  }


  async function request(
    url,
    options = {}
  ) {

    const response =
      await fetch(
        url,
        {
          credentials: "same-origin",

          ...options,

          headers: {
            "Content-Type": "application/json",

            ...(
              options.headers ||
              {}
            )
          }
        }
      );


    let data = {};


    try {

      const text =
        await response.text();


      if (text) {

        try {

          data =
            JSON.parse(text);

        } catch {

          data = {
            raw: text
          };

        }

      }

    } catch {

      data = {};

    }


    return {
      response,
      data
    };
  }


  function getErrorBox() {
    return qs("#loginError");
  }


  function getInfoBox() {
    return qs("#loginInfo");
  }


  function hideMessages() {

    const errorBox =
      getErrorBox();

    const infoBox =
      getInfoBox();


    if (errorBox) {

      errorBox.style.display =
        "none";

      errorBox.textContent =
        "";

    }


    if (infoBox) {

      infoBox.style.display =
        "none";

      infoBox.textContent =
        "";

    }

  }


  function showError(message) {

    const errorBox =
      getErrorBox();

    const infoBox =
      getInfoBox();


    if (infoBox) {

      infoBox.style.display =
        "none";

    }


    if (errorBox) {

      errorBox.textContent =
        message ||
        "Bir hata oluştu.";

      errorBox.style.display =
        "block";

    }

  }


  function showInfo(message) {

    const infoBox =
      getInfoBox();

    const errorBox =
      getErrorBox();


    if (errorBox) {

      errorBox.style.display =
        "none";

    }


    if (infoBox) {

      infoBox.textContent =
        message;

      infoBox.style.display =
        "block";

    }

  }


  function setButtonBusy(busy) {

    const button =
      qs("#loginButton");


    if (!button) {
      return;
    }


    button.disabled =
      busy;


    button.textContent =
      busy
        ? "Giriş yapılıyor..."
        : "Giriş Yap";


    button.style.opacity =
      busy
        ? "0.70"
        : "1";


    button.style.cursor =
      busy
        ? "wait"
        : "pointer";


    button.style.pointerEvents =
      busy
        ? "none"
        : "auto";

  }


  function dashboardExists() {

    return Boolean(
      document.querySelector(
        ".topbar"
      ) ||
      document.querySelector(
        "#appContent"
      ) ||
      document.querySelector(
        ".content"
      )
    );
  }


  function removeOldAppScript() {

    const old =
      document.getElementById(
        "dashboardAppScript"
      );


    if (old) {

      old.remove();

    }

  }


  async function startLoadedApp() {

    /*
      1. Eğer app.js global startApp
      fonksiyonunu açıyorsa direkt çalıştır.
    */

    if (
      typeof window.startApp ===
      "function"
    ) {

      await window.startApp();

      return;
    }


    /*
      2. Bazı sürümlerde showApp global olabilir.
    */

    if (
      typeof window.showApp ===
      "function"
    ) {

      await window.showApp();

      return;
    }


    /*
      Yeni sürümlerde uygulama ad alanı üzerinden de
      güvenli biçimde başlatılabilir.
    */

    if (
      typeof window.BookimedDashboard?.start ===
      "function"
    ) {

      await window.BookimedDashboard.start();

      return;
    }


    if (
      window.__bookimedStartPromise
    ) {

      await window.__bookimedStartPromise;

      return;
    }


    /*
      3. Mevcut app.js DOMContentLoaded
      event'ini dinliyorsa olay daha önce
      gerçekleşmiş durumda.

      Bu nedenle olayı yeniden dispatch ediyoruz.
    */

    document.dispatchEvent(
      new Event(
        "DOMContentLoaded",
        {
          bubbles: true
        }
      )
    );

  }


  async function loadDashboardScript() {

    if (dashboardLoading) {
      return;
    }


    dashboardLoading = true;


    showInfo(
      "Giriş başarılı. Dashboard yükleniyor..."
    );


    removeOldAppScript();


    let appRuntimeError =
      "";


    const runtimeErrorHandler =
      (event) => {

        if (
          !event ||
          !event.filename
        ) {
          return;
        }


        if (
          !String(
            event.filename
          ).includes(
            "/app.js"
          )
        ) {
          return;
        }


        appRuntimeError =
          event.message ||
          "app.js çalışma hatası";


        console.error(
          "APP.JS ERROR:",
          event.error ||
          event.message
        );

      };


    window.addEventListener(
      "error",
      runtimeErrorHandler
    );


    const script =
      document.createElement(
        "script"
      );


    script.id =
      "dashboardAppScript";


    script.src =
      `/app.js?v=${Date.now()}`;


    script.async =
      false;


    script.onload =
      async () => {

        try {

          /*
            app.js dosyası yüklendi.

            Şimdi başlangıç mekanizmasını
            elle tetikliyoruz.
          */

          await startLoadedApp();


          /*
            Dashboard'un DOM'a yazılması
            için kısa süre veriyoruz.
          */

          setTimeout(
            () => {

              window.removeEventListener(
                "error",
                runtimeErrorHandler
              );


              if (
                dashboardExists()
              ) {

                dashboardLoading =
                  false;

                return;

              }


              dashboardLoading =
                false;

              loginBusy =
                false;

              setButtonBusy(
                false
              );


              if (
                appRuntimeError
              ) {

                showError(
                  "Giriş başarılı ancak app.js içinde hata var: " +
                  appRuntimeError
                );

                return;

              }


              showError(
                "Giriş başarılı ancak dashboard başlatılamadı. app.js yüklendi fakat başlangıç fonksiyonu çalışmadı."
              );

            },
            1200
          );


        } catch (error) {

          window.removeEventListener(
            "error",
            runtimeErrorHandler
          );


          console.error(
            "Dashboard start error:",
            error
          );


          dashboardLoading =
            false;

          loginBusy =
            false;

          setButtonBusy(
            false
          );


          showError(
            "Giriş başarılı ancak dashboard açılırken hata oluştu: " +
            (
              error?.message ||
              "Bilinmeyen hata"
            )
          );

        }

      };


    script.onerror =
      () => {

        window.removeEventListener(
          "error",
          runtimeErrorHandler
        );


        dashboardLoading =
          false;

        loginBusy =
          false;


        setButtonBusy(
          false
        );


        showError(
          "public/app.js dosyası sunucudan yüklenemedi."
        );

      };


    document.body.appendChild(
      script
    );

  }


  async function submitLogin() {

    if (loginBusy) {
      return;
    }


    hideMessages();


    const usernameInput =
      qs("#username");

    const passwordInput =
      qs("#password");


    const username =
      String(
        usernameInput?.value ||
        ""
      ).trim();


    const password =
      String(
        passwordInput?.value ||
        ""
      );


    if (!username) {

      showError(
        "Kullanıcı adını giriniz."
      );


      usernameInput?.focus();

      return;
    }


    if (!password) {

      showError(
        "Şifreyi giriniz."
      );


      passwordInput?.focus();

      return;
    }


    loginBusy =
      true;


    setButtonBusy(
      true
    );


    try {

      const {
        response,
        data
      } =
        await request(
          "/api/login",
          {
            method: "POST",

            body:
              JSON.stringify({
                username,
                password
              })
          }
        );


      if (!response.ok) {

        if (
          response.status ===
          401
        ) {

          throw new Error(
            data.error ||
            "Kullanıcı adı veya şifre hatalı."
          );

        }


        throw new Error(
          data.error ||
          `Giriş başarısız. HTTP ${response.status}`
        );

      }


      if (
        data.success ===
        false
      ) {

        throw new Error(
          data.error ||
          "Giriş başarısız."
        );

      }


      /*
        Login başarılı.
        Şimdi app.js yüklenir.
      */

      await loadDashboardScript();


    } catch (error) {

      console.error(
        "LOGIN ERROR:",
        error
      );


      loginBusy =
        false;


      setButtonBusy(
        false
      );


      showError(
        error?.message ||
        "Giriş yapılamadı."
      );

    }

  }


  async function checkExistingSession() {

    try {

      const {
        response,
        data
      } =
        await request(
          "/api/me",
          {
            method: "GET"
          }
        );


      if (
        response.ok &&
        data &&
        data.user
      ) {

        /*
          Session zaten var.
          Tekrar kullanıcı adı/şifre istemeden
          dashboard'u aç.
        */

        showInfo(
          "Oturum bulundu. Dashboard yükleniyor..."
        );


        await loadDashboardScript();

        return;

      }


      setButtonBusy(
        false
      );


    } catch (error) {

      console.warn(
        "Session kontrolü:",
        error
      );


      setButtonBusy(
        false
      );

    }

  }


  function bindLogin() {

    const form =
      qs("#loginForm");

    const button =
      qs("#loginButton");

    const username =
      qs("#username");

    const password =
      qs("#password");


    if (
      !form ||
      !button
    ) {

      console.error(
        "Login form bulunamadı."
      );

      return;
    }


    /*
      FORM SUBMIT
    */

    form.addEventListener(
      "submit",
      (event) => {

        event.preventDefault();

        event.stopPropagation();

        submitLogin();

      }
    );


    /*
      BUTON CLICK
    */

    button.addEventListener(
      "click",
      (event) => {

        event.preventDefault();

        event.stopPropagation();

        submitLogin();

      }
    );


    /*
      ENTER
    */

    [
      username,
      password
    ].forEach(
      (input) => {

        input?.addEventListener(
          "keydown",
          (event) => {

            if (
              event.key ===
              "Enter"
            ) {

              event.preventDefault();

              submitLogin();

            }

          }
        );

      }
    );


    /*
      Başlangıçta buton aktif.
    */

    button.disabled =
      false;


    button.style.pointerEvents =
      "auto";


    button.style.cursor =
      "pointer";


    button.style.opacity =
      "1";


    checkExistingSession();

  }


  /*
    login.js defer ile yüklendiği için
    çoğunlukla DOM hazır olacak.
    Her iki durumu da destekliyoruz.
  */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      bindLogin,
      {
        once: true
      }
    );

  } else {

    bindLogin();

  }

})();
