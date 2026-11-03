// =========================================================================
// CONFIGURAÇÃO DO MODO PRO - DIGITA HINOS FINGERSTYLE
// =========================================================================

const PRO_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz52gKy2eUjo30_BT4nGxXG5f0SFoozVWM_V5LWUWXUptmkr3ZGPCOof2NQJIN9QYX5/exec";

// Função global para validar o código inserido pelo usuário
async function validarCodigoPro(codigoDigitado) {
    if (!codigoDigitado) {
        if (typeof toast === 'function') toast("Digite um código válido!", "error");
        else alert("Digite um código válido!");
        return false;
    }

    if (typeof toast === 'function') toast("Validando código...", "info");

    try {
        const response = await fetch(`${PRO_SCRIPT_URL}?codigo=${encodeURIComponent(codigoDigitado.trim())}`);
        const data = await response.json();

        if (data.status === "sucesso") {
            // Salva no navegador que o usuário é Pro
            localStorage.setItem("isProUser", "true");
            
            if (typeof toast === 'function') {
                toast("🎉 Modo Pro ativado com sucesso!", "success");
            } else {
                alert("Modo Pro ativado com sucesso!");
            }
            
            // Fecha o modal se existir na tela
            const proModal = document.getElementById("proModal");
            if (proModal) proModal.style.display = "none";

            // Recarrega ou atualiza a interface
            setTimeout(() => { location.reload(); }, 1500);
            return true;

        } else if (data.status === "usado") {
            if (typeof toast === 'function') toast("⚠️ Este código já foi resgatado.", "error");
            else alert("Este código já foi resgatado.");
            return false;
        } else {
            if (typeof toast === 'function') toast("❌ Código inválido ou inexistente.", "error");
            else alert("Código inválido ou inexistente.");
            return false;
        }
    } catch (err) {
        console.error("Erro na validação Pro:", err);
        if (typeof toast === 'function') toast("Erro de conexão. Tente novamente.", "error");
        else alert("Erro de conexão. Tente novamente.");
        return false;
    }
}
