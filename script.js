// Acessa o elementos dos seletores deslizantes:
const xSlider = document.getElementById("x");
const ySlider = document.getElementById("y");
const zSlider = document.getElementById("z");

// Acessa o elementos das entradas numéricas:
const xInput = document.getElementById("xInput");
const yInput = document.getElementById("yInput");
const zInput = document.getElementById("zInput");

// Acessa ao elemento do resultado e plot:
const results = document.getElementById("results");
const plotDiv = document.getElementById("plot3d");
const msg = document.getElementById("mensagemErro");

// Acesso aos botões de conexão do Arduino:
const modoCheckbox = document.getElementById("modoManualCheckbox");
const btnDesconectar = document.getElementById("desconectarSerialBtn");

// ======================================================================
// ====================== CONFFIGURAÇÃO DO SISTEMA ======================

// Tamanho dos Elos e dimensões da região de atuação da Garra:
const L0 = 4.0,
    L1 = 12.0,
    L2 = 9.0;
const limiteSuperior = L1 + L2;
const limiteInferior = Math.abs(L1 - L2) + 4;
const altura_min = -7.0;

const base_limite = { inf: 50, sup: 180 };
const ombro_limite = { inf: 5, sup: 180 };
const braco_limite = { inf: 5, sup: 125 };

let angulosAnterior = null;
let currentCamera = null;

// Config para comunicação Serial com Arduino:
let modoAtual = "automatico";
let portaSerial = null;
let writer, reader;
let intervaloLeitura;

// ======================================================================
// ====================== CONFFIGURAÇÃO DO SISTEMA ======================

async function update() {
    // Sincroniza dados do input de Slider com o input de texto:
    const x = parseFloat(xSlider.value);
    const y = parseFloat(ySlider.value);
    const z = parseFloat(zSlider.value);

    xInput.value = x;
    yInput.value = y;
    zInput.value = z;

    // Calcular os ângulos de cada Junta:
    let angulos = cinematicaInversa(x, y, z);

    // Verifica se o movimento é válido:;
    if (angulosAnterior != null && !verificaLimiteAngulo(angulos)) {
        angulos = angulosAnterior;
        // return;
    }

    // console.log(angulos, angulosAnterior);
    // Conversão para radiano:
    anglesRad = {
        base: (angulos.base * Math.PI) / 180,
        ombro: (angulos.ombro * Math.PI) / 180,
        braco: (angulos.braco * Math.PI) / 180,
    };

    // Calcula a posição de todas as juntas, dado os ângulos obtidos:
    let coordenadas = cinematicaDireta(anglesRad);

    // Atualiza o gráfico para a nova posição:
    updatePlot(coordenadas[0], coordenadas[1]);

    angulosAnterior = angulos;

    if (portaSerial !== null) {
        await enviarParaArduino(angulos);
    }
}

// Atualiza valor via input slide:
xSlider.addEventListener("input", () => atualizaLimites("slider"));
ySlider.addEventListener("input", () => atualizaLimites("slider"));
zSlider.addEventListener("input", () => atualizaLimites("slider"));

// Atualiza valor via input block;
xInput.addEventListener("input", () => atualizaLimites("input"));
yInput.addEventListener("input", () => atualizaLimites("input"));
zInput.addEventListener("input", () => atualizaLimites("input"));

update();

// ======================================================================
// ======================= FUNÇÕES PARA O ARDUINO =======================

// Estabelece comunicação com Arduino:
document
    .getElementById("conectarSerialBtn")
    .addEventListener("click", iniciarConexao);

async function iniciarConexao() {
    try {
        portaSerial = await navigator.serial.requestPort();
        await portaSerial.open({ baudRate: 9600 });
        console.log(portaSerial);

        // Escrita Serial:
        const textEncoder = new TextEncoderStream();
        const writableStreamClosed = textEncoder.readable.pipeTo(
            portaSerial.writable
        );
        writer = textEncoder.writable.getWriter();

        // Leitura Serial:
        const decoder = new TextDecoderStream();
        const readableStreamClosed = portaSerial.readable.pipeTo(decoder.writable);

        // Aqui está a diferença:
        const inputStream = decoder.readable.pipeThrough(
        new TransformStream({
            start() {},
            transform(chunk, controller) {
            const linhas = chunk.split('\n');
            for (const linha of linhas) {
                if (linha.trim()) {
                controller.enqueue(linha.trim());
                }
            }
            },
            flush(controller) {}
        })
        );

        // Pegamos o reader da stream transformada (inputStream)
        reader = inputStream.getReader();

        console.log("Reader inicializado:", reader);

        document.getElementById("statusSerial").textContent = "Conectado";

        if (modoAtual === "manual") {
            await iniciarLeituraSerial();
        }

        await enviarModo(modoAtual);
    } catch (err) {
        console.error("Erro ao conectar:", err);
        document.getElementById("statusSerial").textContent =
            "Erro ao conectar";
    }
}

// Atualiza o modo quando a checkbox muda
modoCheckbox.addEventListener("change", async () => {
  modoAtual = modoCheckbox.checked ? "manual" : "automatico";
  await enviarModo(modoAtual);
  console.log("Modo alterado para:", modoAtual);
});

async function enviarModo(modo) {
    if (!portaSerial || !writer) {
        console.warn("Porta serial não conectada.");
        return;
    }

    try {
        const comando = `modo:${modo}\n`;
        await writer.write(comando);
        console.log("Enviado para Arduino:", comando);
    } catch (err) {
        console.error("Erro ao enviar para Arduino:", err);
    }
}

// Envia dados da Interface para o Arduino:
async function enviarParaArduino(angulos) {
    if (!portaSerial || !writer) {
        console.warn("Porta serial não conectada.");
        return;
    }

    try {
        if (writer && modoAtual === "automatico") {
            const comando = `${(angulos.base + 90).toFixed(2)},${(
                angulos.ombro + 15
            ).toFixed(2)},${(-angulos.braco).toFixed(2)}\n`;
            await writer.write(comando);
            console.log("Enviado para Arduino:", comando);
        }
    } catch (err) {
        console.error("Erro ao enviar para Arduino:", err);
    }
}

// Lê dados do Arduino:
async function iniciarLeituraSerial() {
    if (!reader) {
        console.log("deu n")
        return;
    } 
    console.log("oi");
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done || !value) break;

            const linha = value.trim(); // "10,20,30"
            const [base, ombro, braco] = linha.split(",").map(Number);

            if (!isNaN(base) && !isNaN(ombro) && !isNaN(braco)) {
                atualizarInterface({ base, ombro, braco });
            }
        }
    } catch (err) {
        console.error("Erro na leitura serial:", err);
    }
}

// Desconectar da porta serial
btnDesconectar.addEventListener("click", async () => {
  if (reader) {
    try {
      await reader.cancel();
      await reader.releaseLock();
    } catch (e) {
      console.warn("Erro ao cancelar leitura:", e);
    }
  }

  if (writer) {
    try {
      await writer.close();
      writer.releaseLock();
    } catch (e) {
      console.warn("Erro ao fechar writer:", e);
    }
  }

  if (portaSerial) {
    try {
      await portaSerial.close();
      portaSerial = null;
      console.log("Porta serial desconectada.");
      document.getElementById('statusSerial').textContent = 'Desconectado';
    } catch (e) {
      console.error("Erro ao fechar porta:", e);
    }
  }
});

// Atualiza sliders e campos
function atualizarInterface(angulos) {
    console.log("angulos", angulos);

    let angulo_ajustado = {
        base: angulos.base - 90,
        ombro: angulos.ombro - 45,
        braco: -angulos.braco,
    };

    let coordenadas = cinematicaDireta(angulo_ajustado);
    console.log("coordenadas", coordenadas);
    console.log("angulos", angulos);

    xSlider.value = xInput.value = coordenadas[1].x;
    ySlider.value = yInput.value = coordenadas[1].y;
    zSlider.value = zInput.value = coordenadas[1].z;

    update();
}

// ======================================================================
// ========================= FUNÇÕES AUXILIARES =========================

// Realiza a cinemática inversa, retornando os ângulos necessários para
// atingir a posição (x, y, z):
function cinematicaInversa(x, y, z) {
    // segmento equivalente do plano horizontal, a partir da origem:
    const r = Math.hypot(x, y);

    // segmento equivalente até a garra, a partir da origem :
    const dist = Math.sqrt(r * r + z * z);

    if (dist > L1 + L2 || z < altura_min /*|| x < 0*/) {
        results.textContent =
            "Fora do alcance (hemisfério superior, com posição X positiva).";
        Plotly.purge("plot3d");
        return;
    }

    let anguloBase = Math.round((Math.atan2(y, x) * 180) / Math.PI);

    // if (x >= 0) {
    //     anguloBase = Math.max(0, Math.min(180, anguloBase));
    // } else {
    //     anguloBase = Math.max(
    //         0,
    //         Math.min(180, Math.abs(180 - Math.abs(anguloBase)))
    //     );
    // }

    let cosA2 = (r * r + z * z - L1 * L1 - L2 * L2) / (2 * L1 * L2);
    // cosA2 = Math.max(-1, Math.min(1, cosA2));

    let angle2;
    if (x >= 0) {
        angle2 = -Math.acos(cosA2);
    } else {
        angle2 = Math.acos(cosA2);
    }

    const angle2Deg = Math.round((angle2 * 180) / Math.PI);
    const angle2Rad = angle2;

    const k1 = L1 + L2 * Math.cos(angle2);
    const k2 = L2 * Math.sin(angle2);

    let angle1;
    // if (x >= 0) {
    angle1 = Math.atan2(z, r) - Math.atan2(k2, k1);
    // } else {
    //     angle1 = Math.PI - (Math.atan2(z, r) - Math.atan2(k2, k1));
    // }

    const angle1Deg = Math.round((angle1 * 180) / Math.PI);

    angulos = {
        base: anguloBase,
        ombro: angle1Deg,
        braco: angle2Deg,
    };

    if (angulosAnterior != null && !verificaLimiteAngulo(angulos)) {
        angulos = angulosAnterior;
    }

    results.innerHTML = `
    <strong>Base:</strong> ${(angulos.base + 90).toFixed(2)}&deg;<br>
    <strong>Ombro:</strong> ${(angulos.ombro + 15).toFixed(2)}&deg;<br>
    <strong>Cotovelo:</strong> ${(-angulos.braco).toFixed(2)}&deg;<br>
    <strong>Distância:</strong> ${dist.toFixed(2)} cm
  `;

    const radBase = ((anguloBase - 90) * Math.PI) / 180;
    const angle1Rad = angle1;

    if (!verificaLimiteAngulo(angulos)) {
        console.log("Fora de alcance");
    }

    // angulosAnterior = {
    //     base: anguloBase,
    //     ombro: angle1Deg,
    //     braco: angle2Deg,
    // }

    return {
        base: anguloBase,
        ombro: angle1Deg,
        braco: angle2Deg,
    };
    // return [radBase, angle1Rad, angle2Rad];
}

// Realiza a cinemática direta, retornando as posições das juntas dada
// os ângulos cada uma:
function cinematicaDireta(angulos) {
    // Calculo das coordenadas da junta 1:
    const x1 = L1 * Math.cos(angulos.ombro) * Math.cos(angulos.base);
    const y1 = L1 * Math.cos(angulos.ombro) * Math.sin(angulos.base);
    const z1 = L1 * Math.sin(angulos.ombro);

    // Calculo das coordenadas da junta 2:
    const x2 =
        x1 +
        L2 * Math.cos(angulos.ombro + angulos.braco) * Math.cos(angulos.base);
    const y2 =
        y1 +
        L2 * Math.cos(angulos.ombro + angulos.braco) * Math.sin(angulos.base);
    const z2 = z1 + L2 * Math.sin(angulos.ombro + angulos.braco);

    let coords1 = { x: x1, y: y1, z: z1 };
    let coords2 = { x: x2, y: y2, z: z2 };

    return [coords1, coords2];
}

// Função que atualiza o gráfico:
function updatePlot(coords1, coords2) {
    const radius = 5;
    const thetaSteps = 100;
    const theta = Array.from(
        { length: thetaSteps },
        (_, i) => (i * 2 * Math.PI) / (thetaSteps - 1)
    );

    // Tampa inferior (z = 0)
    const xTampa = [],
        yTampa = [],
        zBase = [];
    for (let r = 0; r <= radius; r += radius / 20) {
        const xRow = [],
            yRow = [],
            zRow = [];
        for (let t of theta) {
            xRow.push(r * Math.cos(t));
            yRow.push(r * Math.sin(t));
            zRow.push(0); // Base
        }
        xTampa.push(xRow);
        yTampa.push(yRow);
        zBase.push(zRow);
    }
    const tampaInferior = {
        type: "surface",
        x: xTampa,
        y: yTampa,
        z: zBase,
        colorscale: "Blues",
        showscale: false,
        opacity: 1,
        name: "Base",
    };

    const data = [
        {
            // Garra
            type: "scatter3d",
            mode: "lines+markers",
            marker: { size: 8, color: "black" },
            line: { width: 20, color: "steelblue" },
            x: [0, 0, coords1.x, coords2.x],
            y: [0, 0, coords1.y, coords2.y],
            z: [0, 4, coords1.z, coords2.z],
        },
        {
            // guiaX
            type: "scatter3d",
            mode: "lines",
            line: { dash: "dot", color: "red", width: 5 },
            x: [0, coords2.x],
            y: [coords2.y, coords2.y],
            z: [coords2.z, coords2.z],
            name: "Guia X",
        },

        {
            // guiaY
            type: "scatter3d",
            mode: "lines",
            line: { dash: "dot", color: "red", width: 5 },
            x: [coords2.x, coords2.x],
            y: [0, coords2.y],
            z: [coords2.z, coords2.z],
            name: "Guia Y",
        },

        {
            // guiaZ
            type: "scatter3d",
            mode: "lines",
            line: { dash: "dot", color: "red", width: 5 },
            x: [coords2.x, coords2.x],
            y: [coords2.y, coords2.y],
            z: [0, coords2.z],
            name: "Guia Z",
        },
        // cilindro,
        tampaInferior,
    ];

    const layout = {
        margin: { t: 0 },
        scene: {
            aspectmode: "cube",
            xaxis: { title: "X (cm)", range: [-25, 25] },
            yaxis: { title: "Y (cm)", range: [-25, 25] },
            zaxis: {
                title: "Z (cm)",
                range: [altura_min - 3.1, 50 + altura_min],
            },
            ...(currentCamera ? { camera: currentCamera } : {}),
        },
    };

    Plotly.react(plotDiv, data, layout).then(() => {
        plotDiv.on("plotly_relayout", function (eventdata) {
            if (eventdata["scene.camera"]) {
                currentCamera = eventdata["scene.camera"];
            }
        });
    });
}

// Verifica se os valores de ângulo estão dentro do limite do braço robótico:
function verificaLimiteAngulo(angulos) {
    // console.log("base: ", base_limite, angulos.base+90)
    // console.log("ombro: ", ombro_limite, angulos.ombro)
    // console.log("braco: ", braco_limite, -angulos.braco)
    let baseTest =
        angulos.base + 90 >= base_limite.inf &&
        angulos.base + 90 <= base_limite.sup;
    let ombroTest =
        angulos.ombro + 15 >= ombro_limite.inf &&
        angulos.ombro + 15 <= ombro_limite.sup;
    let bracoTest =
        -angulos.braco >= braco_limite.inf && -angulos.braco <= braco_limite.sup;

    // console.log(baseTest, ombroTest,bracoTest)
    if (baseTest && ombroTest && bracoTest) {
        return true;
    }

    return false;
}

function setLimites(x, y, z) {
    const distancia = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
    if (
        distancia >= limiteInferior &&
        distancia <= limiteSuperior &&
        z >= altura_min /*&& x >= 0*/
    ) {
        // console.log(limiteInferior + " " + distancia + " " + limiteSuperior);
        // Já está dentro dos limites
        return { x, y, z };
    }

    return false;
    //   const fator = limite / distancia;
    //   return {
    //     x: Math.trunc(x * fator * 10) / 10,
    //     y: Math.trunc(y * fator * 10) / 10,
    //     z: Math.trunc(z * fator * 10) / 10,
    //   }
}

// Atualiza coordenadas com restrição de limite dinâmico:
function atualizaLimites(tag) {
    let x, y, z, coordAnterior;

    if (tag == "slider") {
        x = parseFloat(xSlider.value);
        y = parseFloat(ySlider.value);
        z = parseFloat(zSlider.value);

        coordAnterior = {
            x: x - parseFloat(xInput.value),
            y: y - parseFloat(yInput.value),
            z: z - parseFloat(zInput.value),
        };
    } else if (tag == "input") {
        x = parseFloat(xInput.value);
        y = parseFloat(yInput.value);
        z = parseFloat(zInput.value);
        coordAnterior = {
            x: x - parseFloat(xSlider.value),
            y: y - parseFloat(ySlider.value),
            z: z - parseFloat(zSlider.value),
        };
    }
    // console.log(coordAnterior);

    const dx = coordAnterior.x;
    const dy = coordAnterior.y;
    const dz = coordAnterior.z;
    // console.log("coords:", x, y, z);
    // console.log("d_coords:", dx, dy, dz);

    let coords = setLimites(x, y, z);

    // console.log(coords)
    if (!coords) {
        msg.textContent = `❌ Fora de Alcance.`;
        msg.style.display = "block";

        x = x - dx;
        y = y - dy;
        z = z - dz;
        coords = { x, y, z };
        // return;
    } else {
        msg.style.display = "none"; // Oculta mensagem de erro se tudo OK
    }

    // Sincroniza sliders e inputs com o valor limitado
    xSlider.value = xInput.value = coords.x.toFixed(2);
    ySlider.value = yInput.value = coords.y.toFixed(2);
    zSlider.value = zInput.value = coords.z.toFixed(2);

    update();
}

document.getElementById("coordForm").addEventListener("submit", (e) => {
    e.preventDefault(); // Evita recarregar a página

    if (modoAtual !== "automatico") return;

    let x = parseFloat(document.getElementById("xSubmitInput").value);
    let y = parseFloat(document.getElementById("ySubmitInput").value);
    let z = parseFloat(document.getElementById("zSubmitInput").value);

    if (isNaN(x) || isNaN(y) || isNaN(z)) {
        alert("❌ Por favor, preencha todos os valores.");
        msg.style.display = "block";
        return;
    }

    let coordAnterior = {
        x: parseFloat(xInput.value),
        y: parseFloat(yInput.value),
        z: parseFloat(zInput.value),
    };

    // Detecta qual coordenada foi modificada mais significativamente
    // const dx = Math.abs(x - coordAnterior.x);
    // const dy = Math.abs(y - coordAnterior.y);
    // const dz = Math.abs(z - coordAnterior.z);

    // let modifiedAxis = "x";
    // if (dy > dx && dy >= dz) modifiedAxis = "y";
    // else if (dz > dx && dz > dy) modifiedAxis = "z";

    const coords = setLimites(x, y, z);

    msg.style.display = "none"; // Oculta mensagem de erro se tudo OK

    if (!coords) {
        msg.textContent = `❌ Fora de Alcance`;
        msg.style.display = "block";
        return;
    }

    msg.style.display = "none"; // Oculta mensagem de erro se tudo OK

    let coordsTruncadas = {
        x: Math.trunc(coords.x * 10) / 10,
        y: Math.trunc(coords.y * 10) / 10,
        z: Math.trunc(coords.z * 10) / 10,
    };

    // Atualiza todos os sliders e caixas principais com os valores truncados
    xSlider.value = xInput.value = coordsTruncadas.x;
    ySlider.value = yInput.value = coordsTruncadas.y;
    zSlider.value = zInput.value = coordsTruncadas.z;

    updateAnimado(coordAnterior); // Redesenha ou recalcula tudo com os novos valores
    // update();

    e.target.reset();
});

function updateAnimado(coordAnterior) {
    const x = parseFloat(xSlider.value);
    const y = parseFloat(ySlider.value);
    const z = parseFloat(zSlider.value);

    // xInput.value = x;
    // yInput.value = y;
    // zInput.value = z;

    // Calcular os ângulos de cada Junta:
    let angulos = cinematicaInversa(
        coordAnterior.x,
        coordAnterior.y,
        coordAnterior.z
    );
    anglesDest = cinematicaInversa(x, y, z);

    console.log(anglesDest);
    const intervalo = 10; // milissegundos
    let timer = setInterval(() => {
        let mudou = false;
        console.log(angulos);

        if (angulos.base !== anglesDest.base) {
            angulos.base += anglesDest.base > angulos.base ? 1 : -1;
            mudou = true;
        }

        if (angulos.ombro !== anglesDest.ombro) {
            angulos.ombro += anglesDest.ombro > angulos.ombro ? 1 : -1;
            mudou = true;
        }

        if (angulos.braco !== anglesDest.braco) {
            angulos.braco += anglesDest.braco > angulos.braco ? 1 : -1;
            mudou = true;
        }

        anglesRad = {
            base: (angulos.base * Math.PI) / 180,
            ombro: (angulos.ombro * Math.PI) / 180,
            braco: (angulos.braco * Math.PI) / 180,
        };
        console.log(anglesRad);

        const x1 = L1 * Math.cos(anglesRad.ombro) * Math.cos(anglesRad.base);
        const y1 = L1 * Math.cos(anglesRad.ombro) * Math.sin(anglesRad.base);
        const z1 = L1 * Math.sin(anglesRad.ombro);

        const x2 =
            x1 +
            L2 *
                Math.cos(anglesRad.ombro + anglesRad.braco) *
                Math.cos(anglesRad.base);
        const y2 =
            y1 +
            L2 *
                Math.cos(anglesRad.ombro + anglesRad.braco) *
                Math.sin(anglesRad.base);
        const z2 = z1 + L2 * Math.sin(anglesRad.ombro + anglesRad.braco);

        // Novas coordenadas:
        let coords1 = { x: x1, y: y1, z: z1 };
        let coords2 = { x: x2, y: y2, z: z2 };

        // Atualiza o gráfico para a nova posição:
        updatePlot(coords1, coords2);
        enviarParaArduino(angulos);
        // update(); // atualiza o desenho ou envio para Arduino etc

        if (!mudou) {
            clearInterval(timer); // finaliza animação quando tudo chegou
        }
    }, intervalo);
}
