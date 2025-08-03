// ======================================================================
// ======================= INCLUINDO BIBLIOTECAS ========================
#include <Servo.h>

// ======================================================================
// ========================== DEFININDO PINOS ===========================

// Pinos de entrada:
#define SERVO_BRACO_IN A0
#define SERVO_OMBRO_IN A1
#define SERVO_BASE_IN A2

// Pinos de saída:
#define SERVO_BRACO_OUT 5
#define SERVO_OMBRO_OUT 6
#define SERVO_BASE_OUT 7

// ======================================================================
// ===================== INICIALIZANDO BIBLIOTECAS ======================
Servo servo_braco, servo_ombro, servo_base; 

// ======================================================================
// ======================= VARIAVEIS DE CONTROLE ========================
String modoControle = "manual";  // ou "aumatico"
int pos_base, pos_braco, pos_ombro;

// Variaveis para comunicação serial: 
char inChar;
bool auto_mode = false, manual_mode = false;

// LIMITES:

// Braço:
int braco_min = 0, braco_init = 90, braco_max = 125;
// Ombro:
int ombro_min = 0, ombro_init = 160, ombro_max = 180;
// Base:
int base_min = 50, base_init = 90, base_max = 180;

void setup() {
  Serial.begin(9600); // Inicial comunicação serial

  // Define modo dos pinos:
  pinMode(SERVO_BRACO_IN, INPUT_PULLUP);
  pinMode(SERVO_OMBRO_IN, INPUT_PULLUP);
  pinMode(SERVO_BASE_IN, INPUT_PULLUP);

  pinMode(SERVO_BRACO_OUT, OUTPUT);
  pinMode(SERVO_OMBRO_OUT, OUTPUT);
  pinMode(SERVO_BASE_OUT, OUTPUT);
  
  // Inicializa Servos:
  servo_braco.attach(SERVO_BRACO_OUT);
  servo_ombro.attach(SERVO_OMBRO_OUT);
  servo_base.attach(SERVO_BASE_OUT);

  set_pos_inicial();  // Posição inicial do braço robótico
}

void loop() {
  if (Serial.available()) {
    String comando = Serial.readStringUntil('\n');
    comando.trim();

    /*
      A interface se comunica de duas formas com o Arduino:
        1. Seleção do modo de operação
        2. Comando de movimentos
    */

    // 1.
    if (comando.startsWith("modo:")) {
      // Troca o modo de controle
      modoControle = comando.substring(5);
      Serial.print("Modo alterado para: ");
      Serial.println(modoControle);
    } 
    // 2.
    else if (modoControle == "automatico") {
      modo_automatico(comando);
    }

  }

  // Controle via potenciômetros, caso o controe via interface seja desativado:
  if (modoControle == "manual") {
    modo_manual();
  }
}

void set_pos_inicial() {
  servo_braco.write(braco_init);
  servo_ombro.write(ombro_init);
  servo_base.write(base_init);
}

// Controle manual: posição do braço robótico definida por potenciômetros
// e os valores são enviados para a interface via serial.
long time = millis();
void modo_manual() {
  pos_base = analogRead(SERVO_BASE_IN);
  pos_ombro = analogRead(SERVO_OMBRO_IN);
  pos_braco = analogRead(SERVO_BRACO_IN);
  // Serial.println("Base: " + String(pos_base) + "\t\tOmbro: " + String(pos_ombro) + "\t\tBraco: " + String(pos_braco));


  pos_base = map(pos_base, 0, 1023, 0, 180);
  pos_ombro = map(pos_ombro, 0, 1023, 0, 180);
  pos_braco = map(pos_braco, 0, 1023, 0, 180);

  pos_base = constrain(pos_base, base_min, base_max);
  pos_ombro = constrain(pos_ombro, ombro_min, ombro_max);
  pos_braco = constrain(pos_braco, braco_min, braco_max);

  // Serial.println("Base: " + String(pos_base) + "\t\tOmbro: " + String(pos_ombro) + "\t\tBraco: " + String(pos_braco));

  servo_base.write(pos_base);
  servo_ombro.write(pos_ombro);
  servo_braco.write(pos_braco);


  // Manda posição do arduino para a interface (em teste):
  if (millis() - time >= 500) {
    Serial.println(String(pos_base) + "," + String(pos_ombro) + "," + String(pos_braco));
    time = millis();
  }
  delay(50); // tempo entre leituras
}

// Controle via interface: posições são enviadas via serial para o Arduino
void modo_automatico(String comando) {
  int baseIdx = comando.indexOf(',');
  int ombroIdx = comando.indexOf(',', baseIdx + 1);

  if (baseIdx > 0 && ombroIdx > baseIdx) {
    String baseStr = comando.substring(0, baseIdx);
    String ombroStr = comando.substring(baseIdx + 1, ombroIdx);
    String bracoStr = comando.substring(ombroIdx + 1);

    pos_base = constrain(baseStr.toInt(), base_min, base_max);
    pos_ombro = constrain(ombroStr.toInt(), ombro_min, ombro_max);
    pos_braco = constrain(bracoStr.toInt(), braco_min, braco_max);

    // Move os servos
    servo_base.write(pos_base);
    servo_ombro.write(pos_ombro);
    servo_braco.write(pos_braco);

    Serial.print("Movendo para: ");
    Serial.print(pos_base); Serial.print(", ");
    Serial.print(pos_ombro); Serial.print(", ");
    Serial.println(pos_braco);
  }
}