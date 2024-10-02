// frontend/script.js

let net; // PoseNet 모델
let clothingEntity; // A-Frame의 a-image 엔티티

// AR 시작 버튼 클릭 시 호출되는 함수
async function startAR() {
  console.log('AR 시작하기 버튼 클릭됨'); // 디버그용 로그 추가
  // AR 버튼 숨기기
  document.getElementById('ar-button').style.display = 'none';
  
  // 비디오 요소 설정
  const video = document.getElementById('video');
  video.style.display = 'block';
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  video.play();

  // PoseNet 모델 로드
  net = await posenet.load();

  // PoseNet을 사용하여 신체 포인트 감지 시작
  detectPose();
}

// PoseNet을 사용하여 신체 포인트 감지
async function detectPose() {
  console.log('detectPose 함수 호출됨'); // 디버그용 로그 추가
  const video = document.getElementById('video');
  clothingEntity = document.getElementById('clothing');

  // URL에서 product_id 추출
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('product_id');

  if (!productId) {
    console.error('Product ID not found in URL.');
    return;
  }

  try {
    console.log('Fetching product data...'); // 디버그용 로그 추가
    // 백엔드 API에서 제품 정보 가져오기
    const response = await fetch(`https://polochip-27938865dd00.herokuapp.com/api/products/${productId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const product = await response.json();

    if (product.error) {
      console.error(product.error);
      return;
    }

    // 옷 이미지 설정
    clothingEntity.setAttribute('src', product.imageUrl);
    console.log('Product data fetched successfully:', product); // 디버그용 로그 추가
  } catch (error) {
    console.error('Error fetching product data:', error);
    return;
  }

  async function poseDetectionFrame() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      // PoseNet을 사용하여 포즈 추정
      const pose = await net.estimateSinglePose(video, {
        flipHorizontal: true
      });

      // 어깨 포인트 추출
      const leftShoulder = pose.keypoints.find(k => k.part === 'leftShoulder');
      const rightShoulder = pose.keypoints.find(k => k.part === 'rightShoulder');

      if (leftShoulder.score > 0.5 && rightShoulder.score > 0.5) {
        // 중앙 어깨 위치 계산
        const centerX = (leftShoulder.position.x + rightShoulder.position.x) / 2;
        const centerY = (leftShoulder.position.y + rightShoulder.position.y) / 2;

        // 화면 크기 가져오기
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // 중앙 좌표를 -1 ~ 1 범위로 변환 (A-Frame 좌표계에 맞춤)
        const aframeX = (centerX / screenWidth) * 2 - 1;
        const aframeY = -(centerY / screenHeight) * 2 + 1;

        // A-Frame 씬에서 카메라의 월드 좌표 가져오기
        const scene = document.querySelector('a-scene');
        const camera = scene.camera;

        // 중앙 좌표를 3D 공간으로 변환
        const vector = new THREE.Vector3(aframeX, aframeY, -1).unproject(camera);

        // 옷 이미지의 위치 설정 (Z 축을 -3으로 고정)
        clothingEntity.setAttribute('position', `${vector.x} ${vector.y} -3`);
      }
    }

    // 다음 프레임 요청
    requestAnimationFrame(poseDetectionFrame);
  }

  poseDetectionFrame();
}
