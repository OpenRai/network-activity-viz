;; Soft triangle oscillator. Phase is normalized to [0, 1).
;; y = 1.5*x - 0.5*x^3 rounds the triangle's corners.
(module
  (func (export "sample") (param $phase f32) (result f32)
    (local $x f32)
    (local.set $x
      (f32.sub (f32.const 1)
        (f32.mul (f32.const 4)
          (f32.abs (f32.sub (local.get $phase) (f32.const 0.5))))))
    (f32.sub
      (f32.mul (f32.const 1.5) (local.get $x))
      (f32.mul (f32.const 0.5)
        (f32.mul (local.get $x) (f32.mul (local.get $x) (local.get $x)))))))
